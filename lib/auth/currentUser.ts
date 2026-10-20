import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { SESSION_COOKIE, verifySessionToken } from "@/lib/auth/session";
import type { UserRole } from "@/lib/generated/prisma/client";

export interface CurrentUser {
  id: string;
  email: string;
  role: UserRole;
}

// A user who was just confirmed in the database is trusted for a short while,
// so endpoints that are polled every couple of seconds don't hit the database
// each time. Deleting a user (or changing their role) still takes effect
// within this window.
const CACHE_TTL_MS = 30_000;
const confirmed = new Map<string, { user: CurrentUser; until: number }>();

/**
 * The signed-in user, or null. Unlike Proxy (which only checks the cookie is
 * genuine), this also confirms the account still exists.
 */
export async function getCurrentUser(): Promise<CurrentUser | null> {
  const session = verifySessionToken((await cookies()).get(SESSION_COOKIE)?.value);
  if (!session) return null;

  const cached = confirmed.get(session.sub);
  if (cached && cached.until > Date.now()) return cached.user;

  const user = await prisma.user.findUnique({
    where: { id: session.sub },
    select: { id: true, email: true, role: true },
  });
  if (!user) {
    confirmed.delete(session.sub);
    return null;
  }
  confirmed.set(session.sub, { user, until: Date.now() + CACHE_TTL_MS });
  return user;
}

/** For pages: the signed-in user, or a trip through sign-out (which clears a cookie whose account is gone). */
export async function requirePageUser(): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) redirect("/api/auth/logout");
  return user;
}

export class NotSignedInError extends Error {
  constructor() {
    super("Not signed in");
  }
}

/** For route handlers: the signed-in user, or a NotSignedInError that withErrorHandling turns into a 401. */
export async function requireUser(): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) throw new NotSignedInError();
  return user;
}
