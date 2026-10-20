import { createHmac, timingSafeEqual } from "node:crypto";

// Stateless session: `<payload>.<signature>`. The payload is base64url JSON
// ({ sub: userId, exp }) and the signature an HMAC-SHA256 of it keyed by
// AUTH_SECRET, so a cookie can't be forged or edited without that secret.
// Proxy checks it on every request (cookie only, no database); the database
// check that the user still exists lives in lib/auth/currentUser.ts.

export const SESSION_COOKIE = "lead_session";
export const SESSION_MAX_AGE_SECONDS = 7 * 24 * 60 * 60;

export interface SessionPayload {
  sub: string;
  /** Unix seconds. */
  exp: number;
}

function secret(): string {
  const value = process.env.AUTH_SECRET;
  if (!value || value.length < 32) {
    throw new Error(
      "AUTH_SECRET is missing or too short (32+ characters needed). Run `npm run user -- secret` and add the result to .env."
    );
  }
  return value;
}

function sign(body: string): Buffer {
  return createHmac("sha256", secret()).update(body).digest();
}

export function createSessionToken(userId: string, nowMs = Date.now()): string {
  const payload: SessionPayload = { sub: userId, exp: Math.floor(nowMs / 1000) + SESSION_MAX_AGE_SECONDS };
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return `${body}.${sign(body).toString("base64url")}`;
}

/** The session if the token is genuine and unexpired, otherwise null. */
export function verifySessionToken(token: string | undefined, nowMs = Date.now()): SessionPayload | null {
  if (!token) return null;
  const parts = token.split(".");
  if (parts.length !== 2) return null;
  const [body, signature] = parts;

  const expected = sign(body);
  const given = Buffer.from(signature, "base64url");
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) return null;

  try {
    const payload = JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as Partial<SessionPayload>;
    if (typeof payload.sub !== "string" || typeof payload.exp !== "number") return null;
    return payload.exp * 1000 > nowMs ? { sub: payload.sub, exp: payload.exp } : null;
  } catch {
    return null;
  }
}

/** `Secure` only over HTTPS — browsers drop Secure cookies on plain http://localhost. */
export function isSecureRequest(request: Request): boolean {
  return new URL(request.url).protocol === "https:" || request.headers.get("x-forwarded-proto") === "https";
}

export function sessionCookieOptions(secure: boolean) {
  return {
    httpOnly: true,
    secure,
    sameSite: "lax" as const,
    path: "/",
    maxAge: SESSION_MAX_AGE_SECONDS,
  };
}
