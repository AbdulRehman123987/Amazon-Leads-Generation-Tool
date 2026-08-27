# syntax=docker/dockerfile:1

# ---- deps: install once, reused by the builder ----
FROM node:24-alpine AS deps
WORKDIR /app
# Fixed, explicit engine-cache location (rather than $HOME/.cache) so it can
# be copied forward into the runner stage regardless of which user reads it.
ENV XDG_CACHE_HOME=/prisma-cache
COPY package.json package-lock.json ./
COPY prisma ./prisma
COPY prisma.config.ts ./
# DATABASE_URL only needs to be well-formed here — `prisma generate` reads the
# schema, it doesn't connect to a database.
ENV DATABASE_URL="postgresql://user:password@localhost:5432/db"
RUN npm ci --ignore-scripts
COPY docker/prisma-generate.sh /tmp/prisma-generate.sh
RUN chmod +x /tmp/prisma-generate.sh && /tmp/prisma-generate.sh

# ---- builder: compile the Next.js app ----
FROM node:24-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# The generated Prisma client lands in the source tree (custom `output` path
# in schema.prisma, not node_modules) and is .dockerignore'd like it is
# .gitignore'd, so `COPY . .` doesn't bring it — reuse the one `deps` already
# generated instead of paying for the mirror-server dance a second time.
COPY --from=deps /app/lib/generated ./lib/generated
ENV DATABASE_URL="postgresql://user:password@localhost:5432/db"
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build

# ---- runner: minimal production image ----
FROM node:24-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
# The standalone server binds `localhost` unless told otherwise — 0.0.0.0 is
# required for the container's published port to actually reach it.
ENV HOSTNAME=0.0.0.0
ENV PORT=3000
ENV XDG_CACHE_HOME=/prisma-cache

RUN addgroup --system --gid 1001 nodejs \
  && adduser --system --uid 1001 nextjs

# Next's output tracing only follows what the app imports, so it never picks
# up the separate `prisma` CLI binary — copied in explicitly here because the
# entrypoint runs `prisma migrate deploy` before the server starts.
COPY --from=deps /app/prisma ./prisma
COPY --from=deps /app/prisma.config.ts ./prisma.config.ts
COPY --from=deps /app/node_modules/prisma ./node_modules/prisma
COPY --from=deps /app/node_modules/.bin/prisma ./node_modules/.bin/prisma
COPY --from=deps /app/node_modules/@prisma ./node_modules/@prisma
# The schema-engine binary `migrate deploy` needs, already resolved in the
# `deps` stage — carried forward so the container never has to fetch it from
# binaries.prisma.sh at startup.
COPY --from=deps --chown=nextjs:nodejs /prisma-cache /prisma-cache

COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

COPY docker-entrypoint.sh ./
RUN chmod +x docker-entrypoint.sh && chown nextjs:nodejs docker-entrypoint.sh

USER nextjs
EXPOSE 3000

# start-period covers `prisma migrate deploy` running before the server even
# starts listening, plus a cold first request against the DB.
HEALTHCHECK --interval=30s --timeout=5s --start-period=45s --retries=3 \
  CMD wget -qO- http://127.0.0.1:3000/ > /dev/null || exit 1

ENTRYPOINT ["./docker-entrypoint.sh"]
CMD ["node", "server.js"]
