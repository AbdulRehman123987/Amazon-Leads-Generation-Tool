// Who can see what. Every scrape job, product, brand and ad-library row has an
// owner (userId): members only ever see their own; an admin sees everyone's.
// Spread `ownedBy(user)` into the `where` of every query on those tables —
// forgetting it would show one person's leads to another.
import type { CurrentUser } from "@/lib/auth/currentUser";

export function isAdmin(user: Pick<CurrentUser, "role">): boolean {
  return user.role === "ADMIN";
}

/** `{}` for an admin (no restriction), `{ userId }` for everyone else. */
export function ownedBy(user: Pick<CurrentUser, "id" | "role">): { userId?: string } {
  return isAdmin(user) ? {} : { userId: user.id };
}
