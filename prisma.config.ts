import "dotenv/config";
import { defineConfig, env } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    // Migrations need a real session (they take advisory locks). When
    // DATABASE_URL is a pooled URL — Supabase's transaction pooler, port 6543 —
    // set DIRECT_URL to the session/direct one, which is used here instead.
    url: process.env.DIRECT_URL || env("DATABASE_URL"),
  },
});
