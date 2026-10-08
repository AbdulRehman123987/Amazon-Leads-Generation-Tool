import * as cheerio from "cheerio";
import { parseCite, type OrganicResult } from "./googleSearch";

/**
 * Bing is where we look for a brand's website first: its results are plain
 * server-rendered HTML, so an ordinary (non-rendered) scrape.do fetch works
 * and costs 1 credit, versus 10 for a rendered Google page. Verified against
 * live scrape.do output: each organic result is an `li.b_algo` whose title
 * link is a tracking redirect (`bing.com/ck/a?...&u=a1<base64url of the real
 * URL>`), and the destination is also printed in the result's <cite>.
 */

function resolveBingUrl(href: string, citeText: string): string | null {
  try {
    const parsed = new URL(href);
    if (!parsed.hostname.endsWith("bing.com")) return href;
    const u = parsed.searchParams.get("u");
    if (u?.startsWith("a1")) {
      const decoded = Buffer.from(u.slice(2), "base64url").toString("utf8");
      if (/^https?:\/\//i.test(decoded)) return decoded;
    }
  } catch {
    // relative or malformed href — fall through to the printed URL
  }
  return parseCite(citeText);
}

export interface BingParse {
  results: OrganicResult[];
  /**
   * True when the page was neither a results page nor a "no results" page
   * (blocked, CAPTCHA, or changed markup) — the caller should try elsewhere
   * rather than conclude the brand has no website.
   */
  unreadable: boolean;
}

export function parseBingResults(html: string): BingParse {
  const $ = cheerio.load(html);
  const results: OrganicResult[] = [];
  const seen = new Set<string>();

  $("li.b_algo").each((_, el) => {
    const li = $(el);
    const link = li.find("h2 a").first();
    const title = link.text().trim();
    const href = link.attr("href");
    if (!title || !href) return;
    const url = resolveBingUrl(href, li.find("cite").first().text());
    if (!url || seen.has(url)) return;
    seen.add(url);
    results.push({ url, title });
  });

  const noResultsPage =
    $(".b_no").length > 0 || /there are no results for|no results found for/i.test($("body").text());
  return { results, unreadable: results.length === 0 && !noResultsPage };
}
