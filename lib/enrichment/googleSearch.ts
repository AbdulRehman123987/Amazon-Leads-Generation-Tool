import * as cheerio from "cheerio";

/**
 * UNVERIFIED against live output, same caveat as lib/amazon/selectors.ts.
 * Google's own div/class names are obfuscated and churn constantly, so
 * rather than guess at those we anchor on the one structural pattern that's
 * been stable for years: each organic result's title is an <h3> inside the
 * result's link (`<a href="..."><h3>Title</h3></a>`). `div.g` is kept as a
 * secondary fallback in case that ever changes.
 */
const RESULT_LINK_SELECTORS = ["a:has(h3)", "div.g a"];

export interface GoogleOrganicResult {
  url: string;
  title: string;
}

function resolveHref(href: string): string | null {
  // Older/some Google result links wrap the real URL in /url?q=...
  if (href.startsWith("/url?")) {
    const params = new URLSearchParams(href.slice(href.indexOf("?") + 1));
    const q = params.get("q");
    return q && q.startsWith("http") ? q : null;
  }
  return href.startsWith("http") ? href : null;
}

export function parseGoogleOrganicResults(html: string): GoogleOrganicResult[] {
  const $ = cheerio.load(html);
  const results: GoogleOrganicResult[] = [];
  const seen = new Set<string>();

  for (const selector of RESULT_LINK_SELECTORS) {
    $(selector).each((_, el) => {
      const a = $(el);
      const href = a.attr("href");
      if (!href) return;
      const url = resolveHref(href);
      if (!url || seen.has(url)) return;
      const title = a.find("h3").first().text().trim() || a.text().trim();
      if (!title) return;
      seen.add(url);
      results.push({ url, title });
    });
    if (results.length > 0) break; // first selector that matched anything wins
  }

  return results;
}
