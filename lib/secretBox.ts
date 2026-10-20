// Encrypts secrets (people's own API keys) before they go into the database, so
// a database dump or backup doesn't contain working keys. AES-256-GCM, with the
// key derived from API_KEY_SECRET, or from AUTH_SECRET when that isn't set.
//
// The same secret has to be used by every deployment that shares the database
// (a key saved on one can't be read by another with a different secret).
import { createCipheriv, createDecipheriv, hkdfSync, randomBytes } from "node:crypto";

const VERSION = "v1";

function encryptionKey(): Buffer {
  const secret = process.env.API_KEY_SECRET || process.env.AUTH_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error(
      "Saving API keys needs AUTH_SECRET (or API_KEY_SECRET) set to 32+ random characters. Run `npm run user -- secret` and add the result to .env."
    );
  }
  return Buffer.from(hkdfSync("sha256", secret, "lead-scraper", "api-key-encryption", 32));
}

/** `v1.<iv>.<auth tag>.<ciphertext>`, each base64url. */
export function encryptSecret(plain: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", encryptionKey(), iv);
  const data = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  return [VERSION, iv.toString("base64url"), cipher.getAuthTag().toString("base64url"), data.toString("base64url")].join(".");
}

/** Throws if the text isn't ours or was encrypted with a different secret. */
export function decryptSecret(blob: string): string {
  const [version, iv, tag, data] = blob.split(".");
  if (version !== VERSION || !iv || !tag || !data) throw new Error("Not an encrypted secret");
  const decipher = createDecipheriv("aes-256-gcm", encryptionKey(), Buffer.from(iv, "base64url"));
  decipher.setAuthTag(Buffer.from(tag, "base64url"));
  return Buffer.concat([decipher.update(Buffer.from(data, "base64url")), decipher.final()]).toString("utf8");
}
