import { randomBytes, randomInt, scrypt, timingSafeEqual } from "node:crypto";

// Plain TypeScript with only Node built-ins so scripts/users.mjs can load it
// directly, and no native dependency (bcrypt) to bundle into the portable zip.

// scrypt cost. It is stored inside every hash, so it can be raised later
// without invalidating existing passwords.
const N = 32768;
const R = 8;
const P = 1;
const KEY_LENGTH = 64;

function derive(password: string, salt: Buffer, n: number, r: number, p: number): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    // maxmem: Node refuses scrypt allocations above 32 MiB unless told otherwise.
    scrypt(password, salt, KEY_LENGTH, { N: n, r, p, maxmem: 256 * n * r }, (err, key) => {
      if (err) reject(err);
      else resolve(key);
    });
  });
}

/** `scrypt$N$r$p$salt$hash` — safe to store; the password can't be recovered from it. */
export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const key = await derive(password, salt, N, R, P);
  return ["scrypt", N, R, P, salt.toString("base64url"), key.toString("base64url")].join("$");
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [scheme, n, r, p, salt, hash] = stored.split("$");
  if (scheme !== "scrypt" || !salt || !hash) return false;
  try {
    const expected = Buffer.from(hash, "base64url");
    const actual = await derive(password, Buffer.from(salt, "base64url"), Number(n), Number(r), Number(p));
    return actual.length === expected.length && timingSafeEqual(actual, expected);
  } catch {
    return false; // malformed parameters
  }
}

let dummyHash: Promise<string> | undefined;

/** A real hash of a random password, so signing in with an unknown email takes as long as with a real one. */
export function dummyPasswordHash(): Promise<string> {
  dummyHash ??= hashPassword(randomBytes(16).toString("hex"));
  return dummyHash;
}

// No look-alike characters (0/O, 1/l/I) — these get read out and typed by hand.
const PASSWORD_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789";

export function generatePassword(length = 16): string {
  return Array.from({ length }, () => PASSWORD_ALPHABET[randomInt(PASSWORD_ALPHABET.length)]).join("");
}
