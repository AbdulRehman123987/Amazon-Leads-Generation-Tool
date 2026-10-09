// Admin tool for the team's login accounts. There is no sign-up form — this is
// how people get in:
//
//   npm run user -- create <email> [password]    no password given -> a random one is generated and shown once
//   npm run user -- password <email> [password]  change a password (same rule)
//   npm run user -- delete <email>
//   npm run user -- list
//   npm run user -- secret                       prints a new AUTH_SECRET for .env
//
// Runs on Node directly (type stripping loads the shared .ts helpers), with the
// database from DATABASE_URL in .env.
import "dotenv/config";
import { randomBytes, randomUUID } from "node:crypto";
import pg from "pg";
import { sslFor } from "../lib/dbSsl.ts";
import { generatePassword, hashPassword } from "../lib/auth/password.ts";

class UsageError extends Error {}

const [command, emailArg, passwordArg] = process.argv.slice(2);

function normalizeEmail(raw) {
  const email = (raw ?? "").trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new UsageError(`"${raw ?? ""}" is not a valid email address.`);
  }
  return email;
}

function passwordOrGenerated(given) {
  if (given === undefined) return { password: generatePassword(), generated: true };
  if (given.length < 8) throw new UsageError("The password must be at least 8 characters.");
  return { password: given, generated: false };
}

async function run(pool) {
  switch (command) {
    case "create": {
      const email = normalizeEmail(emailArg);
      const { password, generated } = passwordOrGenerated(passwordArg);
      try {
        await pool.query(
          `INSERT INTO "User" ("id", "email", "passwordHash", "updatedAt") VALUES ($1, $2, $3, NOW())`,
          [randomUUID(), email, await hashPassword(password)]
        );
      } catch (err) {
        if (err.code === "23505") {
          throw new UsageError(`${email} already has an account. Use "password" to change their password.`);
        }
        throw err;
      }
      console.log(`Created ${email}.`);
      if (generated) console.log(`Password (shown only now — send it to them privately): ${password}`);
      break;
    }
    case "password": {
      const email = normalizeEmail(emailArg);
      const { password, generated } = passwordOrGenerated(passwordArg);
      const result = await pool.query(
        `UPDATE "User" SET "passwordHash" = $1, "updatedAt" = NOW() WHERE "email" = $2`,
        [await hashPassword(password), email]
      );
      if (result.rowCount === 0) throw new UsageError(`No account for ${email}.`);
      console.log(`Changed the password for ${email}.`);
      if (generated) console.log(`New password (shown only now): ${password}`);
      break;
    }
    case "delete": {
      const email = normalizeEmail(emailArg);
      const result = await pool.query(`DELETE FROM "User" WHERE "email" = $1`, [email]);
      if (result.rowCount === 0) throw new UsageError(`No account for ${email}.`);
      console.log(`Deleted ${email}. They are locked out within about 30 seconds.`);
      break;
    }
    case "list": {
      const { rows } = await pool.query(`SELECT "email", "createdAt" FROM "User" ORDER BY "createdAt"`);
      if (rows.length === 0) console.log("No accounts yet. Create one with: npm run user -- create <email>");
      for (const row of rows) console.log(`${row.email}   (created ${row.createdAt.toISOString().slice(0, 10)})`);
      break;
    }
    default:
      throw new UsageError(
        "Usage: npm run user -- <create|password|delete|list|secret> [email] [password]"
      );
  }
}

async function main() {
  if (command === "secret") {
    console.log(randomBytes(48).toString("base64url"));
    return;
  }

  const url = process.env.DATABASE_URL;
  if (!url) throw new UsageError("DATABASE_URL is not set — add it to .env first.");
  const pool = new pg.Pool({ connectionString: url, ssl: sslFor(url), max: 1, connectionTimeoutMillis: 20_000 });
  try {
    await run(pool);
  } finally {
    await pool.end();
  }
}

main().catch((err) => {
  console.error(err instanceof UsageError ? err.message : `Failed: ${err.message}`);
  process.exitCode = 1;
});
