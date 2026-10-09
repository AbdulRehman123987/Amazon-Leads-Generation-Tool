/**
 * Same-site paths only — never `//evil.com` or `/\evil.com` — so a crafted
 * `?next=` can't send someone to another site after they sign in.
 */
export function safeNextPath(next: string | null | undefined): string {
  if (!next || !next.startsWith("/") || next.startsWith("//") || next.startsWith("/\\")) return "/";
  return next;
}
