import * as cheerio from "cheerio";

/**
 * Verified against live scrape.do output. Each organic result's title is an
 * <h3> inside the result's link (`<a href="..."><h3>Title</h3></a>`); `div.g a`
 * is kept as a secondary fallback in case that ever changes.
 *
 * Google often serves those links as opaque redirects (`/goto?url=<token>`)
 * with no destination in the href at all, so when the href can't be resolved
 * the destination is read from the URL printed under the title (<cite>).
 */
const RESULT_LINK_SELECTORS = ["a:has(h3)", "div.g a"];

export interface OrganicResult {
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

/** First URL-looking token of a <cite>'s text, e.g. "https://example.com › path › page". */
export function parseCite(text: string): string | null {
  const first = text.trim().split(/[\s›]+/)[0] ?? "";
  if (/^https?:\/\//i.test(first)) return first;
  return /^[a-z0-9-]+(\.[a-z0-9-]+)+$/i.test(first) ? `https://${first}` : null;
}

export function parseGoogleOrganicResults(html: string): OrganicResult[] {
  const $ = cheerio.load(html);
  const results: OrganicResult[] = [];
  const seen = new Set<string>();

  for (const selector of RESULT_LINK_SELECTORS) {
    $(selector).each((_, el) => {
      const a = $(el);
      const href = a.attr("href");
      if (!href) return;

      let url = resolveHref(href);
      if (!url) {
        // Climb to this result's own block (never one holding several results) and read its <cite>.
        let block = a.parent();
        for (let depth = 0; depth < 4 && block.length > 0; depth++) {
          if (block.find("a:has(h3)").length > 1) break;
          const cite = block.find("cite").first();
          if (cite.length > 0) {
            url = parseCite(cite.text());
            break;
          }
          block = block.parent();
        }
      }
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
