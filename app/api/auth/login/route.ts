import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { dummyPasswordHash, verifyPassword } from "@/lib/auth/password";
import {
  SESSION_COOKIE,
  createSessionToken,
  isSecureRequest,
  sessionCookieOptions,
} from "@/lib/auth/session";
import {
  clearLoginFailures,
  loginBlockedForSeconds,
  recordLoginFailure,
} from "@/lib/auth/loginRateLimit";
import type { ApiErrorResponse } from "@/lib/types";

function fail(error: string, status: number, headers?: HeadersInit) {
  const body: ApiErrorResponse = { error };
  return NextResponse.json(body, { status, headers });
}

// Public (see proxy.ts) — it is how a session gets created — so it doesn't use
// withErrorHandling, which requires one.
export async function POST(request: Request) {
  try {
    let body: { email?: unknown; password?: unknown };
    try {
      body = await request.json();
    } catch {
      return fail("Invalid JSON body", 400);
    }

    const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
    const password = typeof body.password === "string" ? body.password : "";
    if (!email || !password) return fail("Enter your email and password.", 400);

    const waitSeconds = loginBlockedForSeconds(email);
    if (waitSeconds > 0) {
      return fail(
        `Too many failed attempts. Try again in ${Math.ceil(waitSeconds / 60)} minute(s).`,
        429,
        { "Retry-After": String(waitSeconds) }
      );
    }

    const user = await prisma.user.findUnique({ where: { email } });
    // Verify against a dummy hash for unknown emails so the response time doesn't reveal which emails exist.
    const valid = await verifyPassword(password, user?.passwordHash ?? (await dummyPasswordHash()));
    if (!user || !valid) {
      recordLoginFailure(email);
      return fail("Invalid email or password.", 401);
    }

    clearLoginFailures(email);
    const response = NextResponse.json({ ok: true });
    response.cookies.set(SESSION_COOKIE, createSessionToken(user.id), sessionCookieOptions(isSecureRequest(request)));
    return response;
  } catch (err) {
    console.error("Sign-in failed:", err);
    return fail("Sign-in isn't available right now. Ask your admin to check the server log.", 500);
  }
}
