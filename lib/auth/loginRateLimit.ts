// Slows down password guessing: after MAX_FAILURES wrong passwords for an
// email, further attempts for it are refused until the lockout passes. Kept in
// memory — it resets when the server restarts, which is fine for this scale.

const MAX_FAILURES = 5;
const LOCKOUT_MS = 15 * 60_000;

interface Entry {
  failures: number;
  lockedUntil: number;
}

const attempts = new Map<string, Entry>();

/** Seconds until another attempt is allowed; 0 if it's allowed now. */
export function loginBlockedForSeconds(email: string, now = Date.now()): number {
  const entry = attempts.get(email);
  if (!entry || entry.lockedUntil <= now) return 0;
  return Math.ceil((entry.lockedUntil - now) / 1000);
}

export function recordLoginFailure(email: string, now = Date.now()): void {
  const previous = attempts.get(email);
  // A lockout that has already passed starts the count over.
  const failures = previous && (previous.lockedUntil === 0 || previous.lockedUntil > now) ? previous.failures + 1 : 1;
  attempts.set(email, { failures, lockedUntil: failures >= MAX_FAILURES ? now + LOCKOUT_MS : 0 });
}

export function clearLoginFailures(email: string): void {
  attempts.delete(email);
}
