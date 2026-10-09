import { cookies } from "next/headers";
import { prisma } from "@/lib/db";
import { SESSION_COOKIE, verifySessionToken } from "@/lib/auth/session";

export interface CurrentUser {
  id: string;
  email: string;
}

// A user who was just confirmed in the database is trusted for a short while,
// so endpoints that are polled every couple of seconds don't hit the database
// each time. Deleting a user still locks them out within this window.
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
    select: { id: true, email: true },
  });
  if (!user) {
    confirmed.delete(session.sub);
    return null;
  }
  confirmed.set(session.sub, { user, until: Date.now() + CACHE_TTL_MS });
  return user;
}
