import { PrismaClient } from "@/lib/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

// Prisma 7 requires an explicit driver adapter — plain `pg` works against any
// Postgres-compatible provider (local Postgres, Supabase, Neon, RDS, etc.),
// so swapping providers is just a DATABASE_URL change.
declare global {
  var __prisma: PrismaClient | undefined;
}

// Supabase's pooler accepts plain-text connections, which would send the
// password exchange and every lead over the internet unencrypted, so TLS is
// switched on for Supabase hosts. Its certificate chain isn't in Node's trust
// store though (standard verification fails with SELF_SIGNED_CERT_IN_CHAIN),
// so the chain isn't verified. Don't add `sslmode=` to DATABASE_URL — it would
// override this with strict verification and fail the same way. Local Postgres
// is left unencrypted.
function sslFor(connectionString: string) {
  try {
    const { hostname } = new URL(connectionString);
    return /\.supabase\.(com|co)$/.test(hostname) ? { rejectUnauthorized: false } : undefined;
  } catch {
    return undefined;
  }
}

function createPrismaClient(): PrismaClient {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error(
      "DATABASE_URL is not set. Copy .env.example to .env.local and fill it in."
    );
  }
  const adapter = new PrismaPg({ connectionString, ssl: sslFor(connectionString) });
  return new PrismaClient({ adapter });
}

// Reused across hot-reloads in dev so we don't exhaust DB connections.
function getPrismaClient(): PrismaClient {
  if (!global.__prisma) {
    const client = createPrismaClient();
    if (process.env.NODE_ENV !== "production") global.__prisma = client;
    return client;
  }
  return global.__prisma;
}

// A lazy proxy rather than an eagerly-constructed client: constructing (and
// validating DATABASE_URL) at module-load time would throw during import
// resolution, outside of any route handler's try/catch. Deferring to first
// property access means a missing/bad DATABASE_URL surfaces inside whichever
// request actually touches the database, where it can be caught and turned
// into a proper JSON error response.
export const prisma: PrismaClient = new Proxy({} as PrismaClient, {
  get(_target, prop) {
    const client = getPrismaClient();
    return Reflect.get(client, prop, client);
  },
});
