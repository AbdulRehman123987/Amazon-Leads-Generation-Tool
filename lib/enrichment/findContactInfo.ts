import { scrapeDoFetch, ScrapeDoError } from "@/lib/scrapeDo";
import { parseGoogleOrganicResults, type OrganicResult } from "@/lib/enrichment/googleSearch";
import { parseBingResults } from "@/lib/enrichment/bingSearch";
import { pickBestCandidate } from "@/lib/enrichment/pickWebsite";
import { isParkedPage, pageLooksLikeBrandSite } from "@/lib/enrichment/siteCheck";
import { extractEmail, extractPhone, findContactPageLink } from "@/lib/enrichment/extractContact";
import { appendJobLog } from "@/lib/jobs";
import type { BrandEnrichmentStatus } from "@/lib/generated/prisma/client";

// Entity-agnostic "find a website + email/phone for this name" — shared by
// Amazon-sourced Brand enrichment and Meta Ad Library brand enrichment,
// since both boil down to the exact same problem once you have a company
// name to look up. One place to fix the domain-guess heuristic, the web
// search, and the contact-page crawl for both callers.

// Considerate of both scrape.do and target sites — an entity touches several
// fetches (search + homepage + maybe a contact page).
export const INTER_REQUEST_DELAY_MS = 800;

// Homepage/contact-page guesses don't need scrape.do's full render budget —
// these are opportunistic, unrendered fetches, so a short timeout means a
// slow/dead small-business site fails fast instead of costing a minute-plus.
const PAGE_FETCH_TIMEOUT_MS = 20_000;

const SEARCH_FETCH_TIMEOUT_MS = 30_000;

const CONTACT_PATH_CANDIDATES = ["/contact", "/contact-us", "/about", "/about-us"];

// Amazon "brands" that really mean "no brand" — there's no company to look
// up, and searching for the word only turns up unrelated pages.
const PLACEHOLDER_BRAND_NAMES = new Set([
  "generic", "unbranded", "unknown", "n/a", "na", "none", "no brand", "nobrand", "not applicable", "brand", "oem",
]);

export interface ContactInfoResult {
  websiteUrl: string | null;
  websiteConfidence: number | null;
  email: string | null;
  phone: string | null;
  contactPageUrl: string | null;
  notes: string[];
  /**
   * scrape.do couldn't be reached for part of the lookup, so "nothing found"
   * may only mean "couldn't check" — callers shouldn't record that as NOT_FOUND.
   */
  incomplete: boolean;
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function joinUrl(base: string, path: string): string | null {
  try {
    return new URL(path, base).toString();
  } catch {
    return null;
  }
}

/** scrape.do itself was unreachable (status 0) — not scrape.do reporting a problem with the target site. */
function isNetworkFailure(err: unknown): boolean {
  return err instanceof ScrapeDoError && err.statusCode === 0;
}

function describeError(err: unknown): string {
  return (err as Error).message.replace(/\s+/g, " ").slice(0, 160);
}

/**
 * Many companies sell under their own domain name (uineer.com, ugreen.com,
 * anker.com...) — worth one plain 1-credit fetch before searching. Only
 * trusted if the page looks like the brand's own site: a bare 200 isn't
 * enough, since a coincidentally-registered or parked domain returns one too
 * (confirmed live — honorthy.com and generic.com are for-sale pages,
 * northlight.com redirects to a parking lander, yiwei.com is an unrelated
 * company). Returns the already-fetched HTML too, so the caller doesn't pay
 * for a second fetch of the same page.
 */
async function guessDomainWebsite(
  displayName: string
): Promise<{ site: { url: string; html: string } | null; networkFailure: boolean }> {
  const slug = displayName.toLowerCase().replace(/[^a-z0-9]/g, "");
  if (!slug) return { site: null, networkFailure: false };
  const guessUrl = `https://${slug}.com`;

  let result: Awaited<ReturnType<typeof scrapeDoFetch>>;
  try {
    result = await scrapeDoFetch(guessUrl, { timeoutMs: PAGE_FETCH_TIMEOUT_MS });
  } catch (err) {
    // wrong guess or genuinely unreachable — scrape.do doesn't bill failures
    return { site: null, networkFailure: isNetworkFailure(err) };
  }
  if (result.targetStatusCode >= 400) return { site: null, networkFailure: false };
  if (!pageLooksLikeBrandSite(result.html, displayName, `${slug}.com`)) {
    return { site: null, networkFailure: false };
  }
  return { site: { url: guessUrl, html: result.html }, networkFailure: false };
}

/**
 * Looks the brand up on Bing first (plain fetch, 1 credit). Google (rendered,
 * 10 credits) is only a fallback for when Bing's page can't be read at all —
 * not for Bing simply having no good result, which Google rarely disagrees with.
 */
async function searchWeb(
  query: string,
  notes: string[]
): Promise<{ results: OrganicResult[]; incomplete: boolean }> {
  const encoded = encodeURIComponent(query);

  try {
    const { html } = await scrapeDoFetch(`https://www.bing.com/search?q=${encoded}`, {
      timeoutMs: SEARCH_FETCH_TIMEOUT_MS,
    });
    const parsed = parseBingResults(html);
    if (!parsed.unreadable) return { results: parsed.results, incomplete: false };
    notes.push("Bing's page couldn't be read (blocked or changed) — trying Google");
  } catch (err) {
    notes.push(`Bing search failed: ${describeError(err)}`);
    // If scrape.do itself is unreachable, a 10-credit Google fetch would fail the same way.
    if (isNetworkFailure(err)) return { results: [], incomplete: true };
  }

  try {
    const { html } = await scrapeDoFetch(`https://www.google.com/search?q=${encoded}`, { render: true });
    return { results: parseGoogleOrganicResults(html), incomplete: false };
  } catch (err) {
    notes.push(`Google search failed: ${describeError(err)}`);
    return { results: [], incomplete: isNetworkFailure(err) };
  }
}

/**
 * FOUND if both a website and an email were found, PARTIAL if only one.
 * With nothing found, NOT_FOUND — unless part of the lookup couldn't run
 * (`incomplete`), in which case the brand stays NOT_STARTED so the next
 * enrichment sweep retries it instead of recording a false "not found".
 */
export function computeEnrichmentStatus(
  websiteUrl: string | null,
  email: string | null,
  incomplete = false
): BrandEnrichmentStatus {
  if (websiteUrl && email) return "FOUND";
  if (websiteUrl || email) return "PARTIAL";
  return incomplete ? "NOT_STARTED" : "NOT_FOUND";
}

/**
 * Finds a website (a direct domain guess first, then a Bing search with
 * Google as a fallback — unless `existingWebsiteUrl` is already set, which is
 * never overwritten), then crawls the homepage + a contact/about page for an
 * email/phone. Logs each step to the job (jobId) as it happens — some of
 * these fetches can take tens of seconds, so without incremental logging a
 * slow entity looks identical to a stuck job.
 */
export async function findContactInfo(
  jobId: string,
  label: string,
  existingWebsiteUrl: string | null
): Promise<ContactInfoResult> {
  const notes: string[] = [];
  let websiteUrl = existingWebsiteUrl;
  let websiteConfidence: number | null = null;
  let homepageHtml: string | null = null;
  let websiteFromSearch = false;
  let incomplete = false;

  if (!websiteUrl && PLACEHOLDER_BRAND_NAMES.has(label.trim().toLowerCase())) {
    notes.push(`Skipped — "${label}" is a placeholder, not a real brand name`);
    await appendJobLog(jobId, `${label}: placeholder brand name — skipped`);
    return { websiteUrl: null, websiteConfidence: null, email: null, phone: null, contactPageUrl: null, notes, incomplete: false };
  }

  if (!websiteUrl) {
    const guess = await guessDomainWebsite(label);
    if (guess.networkFailure) incomplete = true;
    if (guess.site) {
      websiteUrl = guess.site.url;
      websiteConfidence = 0.9;
      homepageHtml = guess.site.html;
      notes.push(`Guessed ${guess.site.url} directly (name confirmed on page) — skipped search`);
      await appendJobLog(jobId, `${label}: confirmed ${guess.site.url} — skipping search`);
    }

    if (!websiteUrl) {
      const query = `"${label}" official website`;
      notes.push(`Search query: ${query}`);
      await appendJobLog(jobId, `${label}: searching the web for an official website`);

      const search = await searchWeb(query, notes);
      if (search.incomplete) {
        incomplete = true;
        await appendJobLog(jobId, `${label}: search couldn't reach scrape.do — will retry on the next run`, "warn");
      }

      const { best, considered } = pickBestCandidate(label, search.results);
      notes.push(
        considered.length > 0
          ? `Candidates considered: ${considered
              .map((c) => `${c.url} (${c.excluded ? "excluded" : c.confidence.toFixed(2)})`)
              .join(", ")}`
          : "No search results to choose from"
      );

      if (best) {
        websiteUrl = best.url;
        websiteConfidence = best.confidence;
        websiteFromSearch = true;
        notes.push(`Selected: ${best.url} (confidence ${best.confidence.toFixed(2)})`);
        await appendJobLog(jobId, `${label}: selected ${best.url} (confidence ${best.confidence.toFixed(2)})`);
      } else if (!search.incomplete) {
        await appendJobLog(jobId, `${label}: no website candidate found`, "warn");
      }

      await sleep(INTER_REQUEST_DELAY_MS);
    }
  } else {
    notes.push(`Website already set (${websiteUrl}) — skipping search`);
  }

  let email: string | null = null;
  let phone: string | null = null;
  let contactPageUrl: string | null = null;
  let domainReachable = true;

  if (websiteUrl) {
    if (homepageHtml) {
      // Already fetched as part of the domain guess above — reuse it rather
      // than paying for the same page twice.
      email = extractEmail(homepageHtml);
      phone = extractPhone(homepageHtml);
      if (email || phone) contactPageUrl = websiteUrl;
    } else {
      await appendJobLog(jobId, `${label}: fetching homepage ${websiteUrl}`);
      try {
        const { html } = await scrapeDoFetch(websiteUrl, { timeoutMs: PAGE_FETCH_TIMEOUT_MS });
        if (websiteFromSearch && isParkedPage(html)) {
          notes.push(`Rejected ${websiteUrl} — a parked / for-sale domain, not the brand's site`);
          await appendJobLog(jobId, `${label}: ${websiteUrl} is a parked domain — discarded`, "warn");
          websiteUrl = null;
          websiteConfidence = null;
        } else {
          homepageHtml = html;
          email = extractEmail(html);
          phone = extractPhone(html);
          if (email || phone) contactPageUrl = websiteUrl;
        }
      } catch (err) {
        domainReachable = false;
        if (isNetworkFailure(err)) incomplete = true;
        notes.push(`Homepage fetch failed (${websiteUrl}): ${describeError(err)}`);
        await appendJobLog(jobId, `${label}: homepage unreachable — ${describeError(err)}`, "warn");
      }
    }
  }

  // Only keep guessing /contact, /about, etc. when the domain actually
  // responded — if the homepage itself couldn't be reached, more paths on
  // the same domain are very unlikely to succeed and each one costs up to
  // ~2x PAGE_FETCH_TIMEOUT_MS (scrape.do retries on a 502).
  if (websiteUrl && domainReachable && !(email && phone)) {
    const pagesToTry: string[] = [];

    if (homepageHtml) {
      const navContactLink = findContactPageLink(homepageHtml, websiteUrl);
      if (navContactLink) pagesToTry.push(navContactLink);
    }
    for (const path of CONTACT_PATH_CANDIDATES) {
      const url = joinUrl(websiteUrl, path);
      if (url && !pagesToTry.includes(url)) pagesToTry.push(url);
    }

    for (const pageUrl of pagesToTry) {
      if (email && phone) break;
      await sleep(INTER_REQUEST_DELAY_MS);
      await appendJobLog(jobId, `${label}: trying ${pageUrl}`);
      try {
        const { html, targetStatusCode } = await scrapeDoFetch(pageUrl, {
          timeoutMs: PAGE_FETCH_TIMEOUT_MS,
        });
        if (targetStatusCode >= 400) continue; // path doesn't exist on this site — skip quietly
        const pageEmail = extractEmail(html);
        const pagePhone = extractPhone(html);
        if (pageEmail || pagePhone) {
          email = email ?? pageEmail;
          phone = phone ?? pagePhone;
          contactPageUrl = contactPageUrl ?? pageUrl;
          notes.push(`Found contact info on ${pageUrl}`);
        }
      } catch (err) {
        if (err instanceof ScrapeDoError && (err.statusCode === 404 || err.statusCode === 410)) continue; // no such page
        if (isNetworkFailure(err)) incomplete = true;
        notes.push(`Fetch failed for ${pageUrl}: ${describeError(err)}`);
      }
    }
  } else if (websiteUrl && !domainReachable) {
    notes.push(`Skipped further paths on ${websiteUrl} — homepage was unreachable`);
  }

  return { websiteUrl, websiteConfidence, email, phone, contactPageUrl, notes, incomplete };
}
