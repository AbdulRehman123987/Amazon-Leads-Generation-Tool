// Which scrape.do / SearchAPI.io key a job runs on. Everyone can save their own
// on the Settings page (stored encrypted on their account); a job started by
// someone with their own key uses it, otherwise it falls back to the team's
// shared key from the environment (SCRAPE_DO_API_KEY / SEARCHAPI_API_KEY).
// Set REQUIRE_OWN_API_KEYS=1 to stop members falling back — the admin still may.
import { prisma } from "@/lib/db";
import { decryptSecret } from "@/lib/secretBox";
import { ScrapeDoKeyError } from "@/lib/scrapeDo";
import { SearchApiKeyError } from "@/lib/searchApi";
import type { ApiKeyProblem, ApiKeyState } from "@/lib/types";

export type ApiKeyKind = "scrapeDo" | "searchApi";

export const API_KEY_KINDS = {
  scrapeDo: { label: "scrape.do", envVar: "SCRAPE_DO_API_KEY", column: "scrapeDoApiKey" },
  searchApi: { label: "SearchAPI.io", envVar: "SEARCHAPI_API_KEY", column: "searchApiKey" },
} as const;

export function isApiKeyKind(value: unknown): value is ApiKeyKind {
  return value === "scrapeDo" || value === "searchApi";
}

/** "••••" and the last four characters — all the Settings page ever shows of a saved key. */
export function maskKey(key: string): string {
  return `••••${key.slice(-4)}`;
}

function requireOwnKeys(): boolean {
  return process.env.REQUIRE_OWN_API_KEYS === "1";
}

function sharedKey(kind: ApiKeyKind): string | undefined {
  return process.env[API_KEY_KINDS[kind].envVar]?.trim() || undefined;
}

/** A saved key, or null; `unreadable` when one is saved but can't be decrypted (the server secret changed). */
function readSavedKey(stored: string | null | undefined): { key: string | null; unreadable: boolean } {
  if (!stored) return { key: null, unreadable: false };
  try {
    return { key: decryptSecret(stored), unreadable: false };
  } catch {
    return { key: null, unreadable: true };
  }
}

export type KeySource = "own" | "shared";

export interface ResolvedKey {
  key: string;
  source: KeySource;
}

/** Nothing usable to run on. The message says what to do, and is shown to the person as is. */
export class MissingApiKeyError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "MissingApiKeyError";
  }
}

/**
 * The key a job started by `userId` runs on: their own if saved, else the
 * shared one. Throws MissingApiKeyError when there is none to use — call it
 * before creating a job so the person is told right away, and again when the
 * runner starts (the key may have changed in between).
 */
export async function resolveApiKey(kind: ApiKeyKind, userId: string | null): Promise<ResolvedKey> {
  const { label, column } = API_KEY_KINDS[kind];
  const user = userId
    ? await prisma.user.findUnique({
        where: { id: userId },
        select: { role: true, scrapeDoApiKey: true, searchApiKey: true },
      })
    : null;

  const saved = readSavedKey(user?.[column]);
  if (saved.key) return { key: saved.key, source: "own" };

  const mustUseOwn = requireOwnKeys() && user?.role === "MEMBER";
  const shared = sharedKey(kind);
  if (shared && !mustUseOwn) return { key: shared, source: "shared" };

  if (saved.unreadable) {
    throw new MissingApiKeyError(`Your saved ${label} key can't be read any more. Enter it again in Settings.`);
  }
  if (mustUseOwn) {
    throw new MissingApiKeyError(`Add your own ${label} key in Settings before you start this.`);
  }
  throw new MissingApiKeyError(`No ${label} key is set up yet. Add yours in Settings.`);
}

/** Said at the top of a job's log, so it's clear whose credits it is spending. */
export function keySourceNote(kind: ApiKeyKind, source: KeySource): string {
  return `Using ${source === "own" ? "your own" : "the team's shared"} ${API_KEY_KINDS[kind].label} key`;
}

/** What to tell the person when the service turned a job away because of the key. */
export function keyProblemMessage(kind: ApiKeyKind, source: KeySource, reason: ApiKeyProblem): string {
  const { label } = API_KEY_KINDS[kind];
  if (source === "own") {
    return reason === "invalid"
      ? `Your ${label} key was rejected. Check it in Settings.`
      : `Your ${label} key has no credits left. Top it up, or replace it in Settings.`;
  }
  return reason === "invalid"
    ? `The team's shared ${label} key was rejected. Add your own key in Settings, or tell the admin.`
    : `The team's shared ${label} key has no credits left. Add your own key in Settings, or tell the admin.`;
}

/** The text for a failed job: a key problem gets the plain-language message, anything else its own. */
export function jobFailureMessage(err: unknown, kind: ApiKeyKind, source: KeySource): string {
  if (err instanceof ScrapeDoKeyError || err instanceof SearchApiKeyError) {
    return keyProblemMessage(kind, source, err.reason);
  }
  return err instanceof Error ? err.message : String(err);
}

export interface KeyStatus {
  kind: ApiKeyKind;
  label: string;
  state: ApiKeyState;
  /** "••••1234" when `state` is "own". */
  hint: string | null;
  /** Something is saved (readable or not), so there is something to remove. */
  hasSaved: boolean;
}

/** What the Settings page shows for each key of one person. */
export async function getKeyStatuses(userId: string): Promise<KeyStatus[]> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { role: true, scrapeDoApiKey: true, searchApiKey: true },
  });
  const mustUseOwn = requireOwnKeys() && user?.role === "MEMBER";

  return (Object.keys(API_KEY_KINDS) as ApiKeyKind[]).map((kind) => {
    const { label, column } = API_KEY_KINDS[kind];
    const saved = readSavedKey(user?.[column]);
    let state: ApiKeyState;
    if (saved.key) state = "own";
    else if (mustUseOwn) state = saved.unreadable ? "unreadable" : "required";
    else if (saved.unreadable) state = "unreadable";
    else state = sharedKey(kind) ? "shared" : "missing";
    return {
      kind,
      label,
      state,
      hint: saved.key ? maskKey(saved.key) : null,
      hasSaved: Boolean(user?.[column]),
    };
  });
}

export type KeyCheck =
  | { result: "valid"; creditsLeft: number | null }
  | { result: "invalid" }
  | { result: "unreachable" };

async function getJson(url: string): Promise<{ status: number; json: unknown } | null> {
  for (let attempt = 1; attempt <= 2; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 15_000);
    try {
      const res = await fetch(url, { signal: controller.signal, cache: "no-store" });
      const text = await res.text();
      let json: unknown = null;
      try {
        json = JSON.parse(text);
      } catch {
        // not JSON (e.g. an empty 401 body) — the status is what matters then
      }
      return { status: res.status, json };
    } catch {
      // a network hiccup: try once more, then give up
    } finally {
      clearTimeout(timer);
    }
  }
  return null;
}

const asRecord = (value: unknown): Record<string, unknown> =>
  value && typeof value === "object" ? (value as Record<string, unknown>) : {};

/**
 * Asks the service about a key before it is saved. Both have a free account
 * endpoint (no credits used): scrape.do's /info answers 200 for any token and
 * says `IsActive: false` for one it doesn't know; SearchAPI.io's /me answers 401.
 */
export async function checkApiKey(kind: ApiKeyKind, key: string): Promise<KeyCheck> {
  if (kind === "scrapeDo") {
    const reply = await getJson(`https://api.scrape.do/info?token=${encodeURIComponent(key)}`);
    if (!reply) return { result: "unreachable" };
    if (reply.status === 401 || reply.status === 403) return { result: "invalid" };
    const info = asRecord(reply.json);
    if (reply.status !== 200 || typeof info.IsActive !== "boolean") return { result: "unreachable" };
    if (!info.IsActive) return { result: "invalid" };
    return {
      result: "valid",
      creditsLeft: typeof info.RemainingMonthlyRequest === "number" ? info.RemainingMonthlyRequest : null,
    };
  }

  const reply = await getJson(`https://www.searchapi.io/api/v1/me?api_key=${encodeURIComponent(key)}`);
  if (!reply) return { result: "unreachable" };
  if (reply.status === 401 || reply.status === 403) return { result: "invalid" };
  if (reply.status !== 200) return { result: "unreachable" };
  const credits = asRecord(asRecord(reply.json).account).remaining_credits;
  return { result: "valid", creditsLeft: typeof credits === "number" ? credits : null };
}
