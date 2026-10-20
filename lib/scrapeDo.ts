/**
 * Single entry point for every outbound fetch the app makes (Amazon pages,
 * Google search result pages, brand websites) — all routed through the
 * scrape.do proxy/rendering API. See https://scrape.do/documentation/ for
 * the upstream contract this wraps.
 */

import type { ApiKeyProblem } from "@/lib/types";

const SCRAPE_DO_BASE_URL = "https://api.scrape.do/";
const DEFAULT_TIMEOUT_MS = 60_000;
const MAX_ATTEMPTS = 3;

// Errors raised while still connecting to scrape.do — it never saw the
// request, so nothing was billed and retrying is safe.
const CONNECT_ERROR_CODES = new Set([
  "UND_ERR_CONNECT_TIMEOUT",
  "ECONNREFUSED",
  "ENOTFOUND",
  "EAI_AGAIN",
  "ETIMEDOUT",
]);

function errorCauseCode(err: unknown): string | undefined {
  return (err as { cause?: { code?: string } } | null)?.cause?.code;
}

export interface ScrapeDoOptions {
  /** Render with a headless browser — needed for JS-heavy / bot-gated pages. */
  render?: boolean;
  /** Route through scrape.do's residential/mobile proxy pool instead of datacenter. */
  super?: boolean;
  /** Two-letter country code to geolocate the proxy. */
  geoCode?: string;
  device?: "desktop" | "mobile" | "tablet";
  /** CSS selector to wait for before returning, when render=true. */
  waitSelector?: string;
  /** Extra ms to wait after load, when render=true. */
  customWait?: number;
  /** scrape.do-side request budget in ms (also used to size our own abort timeout). */
  timeoutMs?: number;
}

export interface ScrapeDoResult {
  html: string;
  /** The target site's own status code (from Scrape.do-Initial-Status-Code), not scrape.do's. */
  targetStatusCode: number;
  resolvedUrl: string;
  requestCost?: number;
  remainingCredits?: number;
}

export class ScrapeDoError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number,
    public readonly body?: string
  ) {
    super(message);
    this.name = "ScrapeDoError";
  }
}

/**
 * scrape.do itself turned the request away because of the API key, not the
 * target site: it answers 401 with `Scrape.do-Auth: 0`, and a key that is valid
 * but has no credits left also carries `Scrape.do-Remaining-Credits`. Every other
 * request would fail the same way, so callers stop instead of going on.
 */
export class ScrapeDoKeyError extends ScrapeDoError {
  constructor(public readonly reason: ApiKeyProblem) {
    super(
      reason === "no-credits" ? "scrape.do reports no credits left on this API key" : "scrape.do rejected the API key",
      401
    );
    this.name = "ScrapeDoKeyError";
  }
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function parseNumericHeader(value: string | null): number | undefined {
  if (!value) return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

/**
 * Fetches `targetUrl` through scrape.do and returns the target page's HTML.
 * `apiKey` is whoever started the job's key (see lib/apiKeys.ts) — never read
 * from the environment here, so a call can't quietly fall back to the shared one.
 * Retries on a scrape.do-side 502 (their documented "please retry" signal)
 * and on connections to scrape.do that never established (flaky networks).
 * Throws ScrapeDoKeyError when scrape.do refuses the key.
 */
export async function scrapeDoFetch(
  targetUrl: string,
  apiKey: string,
  options: ScrapeDoOptions = {}
): Promise<ScrapeDoResult> {
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const params = new URLSearchParams({
    token: apiKey,
    url: targetUrl,
    timeout: String(timeoutMs),
  });
  if (options.render) params.set("render", "true");
  if (options.super) params.set("super", "true");
  if (options.geoCode) params.set("geoCode", options.geoCode);
  if (options.device) params.set("device", options.device);
  if (options.waitSelector) params.set("waitSelector", options.waitSelector);
  if (options.customWait) params.set("customWait", String(options.customWait));

  const requestUrl = `${SCRAPE_DO_BASE_URL}?${params.toString()}`;

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    const controller = new AbortController();
    // Give the client a bit more headroom than the scrape.do-side timeout so
    // scrape.do's own timeout error has a chance to come back first.
    const clientTimer = setTimeout(() => controller.abort(), timeoutMs + 15_000);

    let response: Response;
    try {
      response = await fetch(requestUrl, {
        method: "GET",
        signal: controller.signal,
      });
    } catch (err) {
      clearTimeout(clientTimer);
      const isAbort = err instanceof Error && err.name === "AbortError";
      const causeCode = isAbort ? undefined : errorCauseCode(err);
      if (causeCode && CONNECT_ERROR_CODES.has(causeCode) && attempt < MAX_ATTEMPTS) {
        await sleep(1000 * attempt);
        continue;
      }
      throw new ScrapeDoError(
        isAbort
          ? `scrape.do request timed out after ${timeoutMs + 15_000}ms fetching ${targetUrl}`
          : `scrape.do request failed for ${targetUrl}: ${(err as Error).message}${causeCode ? ` (${causeCode})` : ""}`,
        0
      );
    }
    clearTimeout(clientTimer);

    const body = await response.text();

    if (response.status === 401 && response.headers.get("Scrape.do-Auth") === "0") {
      throw new ScrapeDoKeyError(response.headers.has("Scrape.do-Remaining-Credits") ? "no-credits" : "invalid");
    }

    if (response.status === 502 && attempt < MAX_ATTEMPTS) {
      await sleep(1000 * attempt);
      continue;
    }

    if (!response.ok) {
      throw new ScrapeDoError(
        `scrape.do returned ${response.status} for ${targetUrl}: ${body.slice(0, 300)}`,
        response.status,
        body
      );
    }

    const targetStatusCode =
      parseNumericHeader(response.headers.get("Scrape.do-Initial-Status-Code")) ??
      response.status;

    return {
      html: body,
      targetStatusCode,
      resolvedUrl: response.headers.get("Scrape.do-Resolved-Url") ?? targetUrl,
      requestCost: parseNumericHeader(response.headers.get("Scrape.do-Request-Cost")),
      remainingCredits: parseNumericHeader(
        response.headers.get("Scrape.do-Remaining-Credits")
      ),
    };
  }

  // Unreachable — the loop always returns or throws — but keeps TypeScript happy.
  throw new ScrapeDoError(`scrape.do request failed for ${targetUrl}`, 0);
}
