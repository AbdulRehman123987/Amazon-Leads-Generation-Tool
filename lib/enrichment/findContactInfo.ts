import { scrapeDoFetch } from "@/lib/scrapeDo";
import { parseGoogleOrganicResults } from "@/lib/enrichment/googleSearch";
import { pickBestCandidate } from "@/lib/enrichment/pickWebsite";
import { extractEmail, extractPhone, findContactPageLink } from "@/lib/enrichment/extractContact";
import { appendJobLog } from "@/lib/jobs";
import type { BrandEnrichmentStatus } from "@/lib/generated/prisma/client";

// Entity-agnostic "find a website + email/phone for this name" — shared by
// Amazon-sourced Brand enrichment and Meta Ad Library brand enrichment,
// since both boil down to the exact same problem once you have a company
// name to look up. One place to fix the domain-guess heuristic, the Google
// fallback, and the contact-page crawl for both callers.

// Considerate of both scrape.do and target sites (Google included) — an
// entity touches several fetches (search + homepage + maybe a contact page).
export const INTER_REQUEST_DELAY_MS = 800;

// Homepage/contact-page guesses don't need scrape.do's full render budget —
// these are opportunistic, unrendered fetches, so a short timeout means a
// slow/dead small-business site fails fast instead of costing a minute-plus.
const PAGE_FETCH_TIMEOUT_MS = 20_000;

const CONTACT_PATH_CANDIDATES = ["/contact", "/contact-us", "/about", "/about-us"];

export interface ContactInfoResult {
  websiteUrl: string | null;
  websiteConfidence: number | null;
  email: string | null;
  phone: string | null;
  contactPageUrl: string | null;
  notes: string[];
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

function nameTokens(name: string): string[] {
  return name
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((token) => token.length > 2);
}

/**
 * Many companies sell under their own domain name (uineer.com, ugreen.com,
 * anker.com...) — worth one plain 1-credit fetch before paying scrape.do's
 * 10-credit Google-search rate. Only trusted if the fetched page's own
 * content actually mentions the name: a coincidentally-registered domain
 * can return a real 200 for an unrelated site (confirmed live — "tagry.com"
 * resolves, but the brand's real site is "tagrystore.com"), so a bare 200
 * isn't enough signal on its own. Returns the already-fetched HTML too, so
 * the caller doesn't pay for a second fetch of the same page.
 */
async function guessDomainWebsite(
  displayName: string
): Promise<{ url: string; html: string } | null> {
  const slug = displayName.toLowerCase().replace(/[^a-z0-9]/g, "");
  if (!slug) return null;
  const guessUrl = `https://${slug}.com`;

  let result: Awaited<ReturnType<typeof scrapeDoFetch>>;
  try {
    result = await scrapeDoFetch(guessUrl, { timeoutMs: PAGE_FETCH_TIMEOUT_MS });
  } catch {
    return null; // wrong guess or genuinely unreachable — scrape.do doesn't bill failures
  }
  if (result.targetStatusCode >= 400) return null;

  const tokens = nameTokens(displayName);
  const haystack = result.html.slice(0, 20_000).toLowerCase();
  const matchesName = tokens.length > 0 && tokens.some((token) => haystack.includes(token));
  if (!matchesName) return null;

  return { url: guessUrl, html: result.html };
}

/** FOUND if both a website and an email were found, PARTIAL if only one, NOT_FOUND otherwise. */
export function computeEnrichmentStatus(
  websiteUrl: string | null,
  email: string | null
): BrandEnrichmentStatus {
  if (websiteUrl && email) return "FOUND";
  if (websiteUrl || email) return "PARTIAL";
  return "NOT_FOUND";
}

/**
 * Finds a website (a direct domain guess first, then Google as a 10x-more-
 * expensive fallback — unless `existingWebsiteUrl` is already set, which is
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

  if (!websiteUrl) {
    const guess = await guessDomainWebsite(label);
    if (guess) {
      websiteUrl = guess.url;
      websiteConfidence = 0.9;
      homepageHtml = guess.html;
      notes.push(`Guessed ${guess.url} directly (name confirmed on page) — skipped Google search`);
      await appendJobLog(jobId, `${label}: confirmed ${guess.url} — skipping Google search`);
    }

    if (!websiteUrl) {
      const query = `"${label}" official website`;
      const searchUrl = `https://www.google.com/search?q=${encodeURIComponent(query)}`;
      notes.push(`Google query: ${query}`);
      await appendJobLog(jobId, `${label}: searching Google for an official website`);

      try {
        const { html } = await scrapeDoFetch(searchUrl, { render: true });
        const results = parseGoogleOrganicResults(html);
        const { best, considered } = pickBestCandidate(label, results);

        notes.push(
          considered.length > 0
            ? `Candidates considered: ${considered
                .map((c) => `${c.url} (${c.excluded ? "excluded" : c.confidence.toFixed(2)})`)
                .join(", ")}`
            : "No organic results parsed from the search page"
        );

        if (best) {
          websiteUrl = best.url;
          websiteConfidence = best.confidence;
          notes.push(`Selected: ${best.url} (confidence ${best.confidence.toFixed(2)})`);
          await appendJobLog(
            jobId,
            `${label}: selected ${best.url} (confidence ${best.confidence.toFixed(2)})`
          );
        } else {
          await appendJobLog(jobId, `${label}: no website candidate found`, "warn");
        }
      } catch (err) {
        notes.push(`Google search failed: ${(err as Error).message}`);
        await appendJobLog(jobId, `${label}: Google search failed — ${(err as Error).message}`, "warn");
      }

      await sleep(INTER_REQUEST_DELAY_MS);
    }
  } else {
    notes.push(`Website already set (${websiteUrl}) — skipping Google search`);
  }

  let email: string | null = null;
  let phone: string | null = null;
  let contactPageUrl: string | null = null;

  if (websiteUrl) {
    let domainReachable = true;

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
        homepageHtml = html;
        email = extractEmail(html);
        phone = extractPhone(html);
        if (email || phone) contactPageUrl = websiteUrl;
      } catch (err) {
        domainReachable = false;
        notes.push(`Homepage fetch failed (${websiteUrl}): ${(err as Error).message}`);
        await appendJobLog(jobId, `${label}: homepage unreachable — ${(err as Error).message}`, "warn");
      }
    }

    // Only keep guessing /contact, /about, etc. when the domain actually
    // responded — if the homepage itself couldn't be reached, more paths on
    // the same domain are very unlikely to succeed and each one costs up to
    // ~2x PAGE_FETCH_TIMEOUT_MS (scrape.do retries once on a 502).
    if (domainReachable && !(email && phone)) {
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
          notes.push(`Fetch failed for ${pageUrl}: ${(err as Error).message}`);
        }
      }
    } else if (!domainReachable) {
      notes.push(`Skipped further paths on ${websiteUrl} — homepage was unreachable`);
    }
  }

  return { websiteUrl, websiteConfidence, email, phone, contactPageUrl, notes };
}
