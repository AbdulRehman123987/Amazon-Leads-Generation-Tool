// Admin tool for the team's login accounts. There is no sign-up form — this is
// how people get in:
//
//   npm run user -- create <email> [password] [--admin]   no password given -> a random one is generated and shown once
//   npm run user -- password <email> [password]           change a password (same rule)
//   npm run user -- role <email> <admin|member>           an admin sees everyone's data; a member only their own
//   npm run user -- delete <email>
//   npm run user -- list
//   npm run user -- secret                                prints a new AUTH_SECRET for .env
//
// Runs on Node directly (type stripping loads the shared .ts helpers), with the
// database from DATABASE_URL in .env.
import "dotenv/config";
import { randomBytes, randomUUID } from "node:crypto";
import pg from "pg";
import { sslFor } from "../lib/dbSsl.ts";
import { generatePassword, hashPassword } from "../lib/auth/password.ts";

class UsageError extends Error {}

const args = process.argv.slice(2);
const makeAdmin = args.includes("--admin");
const [command, emailArg, passwordArg] = args.filter((arg) => arg !== "--admin");

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

/** Someone has to be able to see everyone's data, so the last admin can't be demoted or deleted. */
async function assertAnotherAdminExists(pool, email, doing) {
  const { rows } = await pool.query(
    `SELECT COUNT(*)::int AS n FROM "User" WHERE "role" = 'ADMIN' AND "email" <> $1`,
    [email]
  );
  if (rows[0].n === 0) {
    throw new UsageError(`${doing} ${email} would leave no admin. Make someone else an admin first.`);
  }
}

async function run(pool) {
  switch (command) {
    case "create": {
      const email = normalizeEmail(emailArg);
      const { password, generated } = passwordOrGenerated(passwordArg);
      try {
        await pool.query(
          `INSERT INTO "User" ("id", "email", "passwordHash", "role", "updatedAt") VALUES ($1, $2, $3, $4, NOW())`,
          [randomUUID(), email, await hashPassword(password), makeAdmin ? "ADMIN" : "MEMBER"]
        );
      } catch (err) {
        if (err.code === "23505") {
          throw new UsageError(`${email} already has an account. Use "password" to change their password.`);
        }
        throw err;
      }
      console.log(`Created ${email}${makeAdmin ? " as an admin" : ""}.`);
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
    case "role": {
      const email = normalizeEmail(emailArg);
      const role = (passwordArg ?? "").toLowerCase();
      if (role !== "admin" && role !== "member") {
        throw new UsageError("Usage: npm run user -- role <email> <admin|member>");
      }
      if (role === "member") await assertAnotherAdminExists(pool, email, "Making a member of");
      const result = await pool.query(
        `UPDATE "User" SET "role" = $1, "updatedAt" = NOW() WHERE "email" = $2`,
        [role.toUpperCase(), email]
      );
      if (result.rowCount === 0) throw new UsageError(`No account for ${email}.`);
      console.log(`${email} is now ${role === "admin" ? "an admin" : "a member"}. It takes effect within about 30 seconds.`);
      break;
    }
    case "delete": {
      const email = normalizeEmail(emailArg);
      await assertAnotherAdminExists(pool, email, "Deleting");
      const result = await pool.query(`DELETE FROM "User" WHERE "email" = $1`, [email]);
      if (result.rowCount === 0) throw new UsageError(`No account for ${email}.`);
      console.log(`Deleted ${email}. They are locked out within about 30 seconds.`);
      console.log("Their scrapes, products and brands are kept, and only an admin can see them now.");
      break;
    }
    case "list": {
      const { rows } = await pool.query(`SELECT "email", "role", "createdAt" FROM "User" ORDER BY "createdAt"`);
      if (rows.length === 0) console.log("No accounts yet. Create one with: npm run user -- create <email>");
      for (const row of rows) {
        console.log(`${row.email}   ${row.role.toLowerCase()}   (created ${row.createdAt.toISOString().slice(0, 10)})`);
      }
      break;
    }
    default:
      throw new UsageError(
        "Usage: npm run user -- <create|password|role|delete|list|secret> [email] [password|admin|member] [--admin]"
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
