import { PrismaClient } from "@/lib/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { sslFor } from "@/lib/dbSsl";

// Prisma 7 requires an explicit driver adapter — plain `pg` works against any
// Postgres-compatible provider (local Postgres, Supabase, Neon, RDS, etc.),
// so swapping providers is just a DATABASE_URL change.
declare global {
  var __prisma: PrismaClient | undefined;
}

function createPrismaClient(): PrismaClient {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error(
      "DATABASE_URL is not set. Copy .env.example to .env.local and fill it in."
    );
  }
  // A small pool: with several copies of the app sharing one Supabase project
  // (each team member's PC), the pooler's connection limit is the bottleneck.
  const adapter = new PrismaPg({ connectionString, ssl: sslFor(connectionString), max: 5 });
  return new PrismaClient({ adapter });
}

// One client (one connection pool) per process. Cached on globalThis in every
// environment: in dev so hot reloads reuse it, and in production because this
// lazy proxy has no other module-level instance — without the cache every
// property access would build a new client and open new connections.
function getPrismaClient(): PrismaClient {
  global.__prisma ??= createPrismaClient();
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
