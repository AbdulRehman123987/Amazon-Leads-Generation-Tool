import * as cheerio from "cheerio";

const EMAIL_REGEX = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
const PHONE_REGEX = /(?:\+?1[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/g;

// Local-parts that are almost never a useful human/company contact address.
const GENERIC_LOCAL_PART_BLOCKLIST = ["noreply", "no-reply", "example", "sentry", "wixpress", "godaddy"];

function isPlausibleEmail(address: string): boolean {
  const local = address.split("@")[0]?.toLowerCase() ?? "";
  if (GENERIC_LOCAL_PART_BLOCKLIST.some((bad) => local.includes(bad))) return false;
  // Loose text-scan regexes sometimes grab image filenames like foo@2x.png.
  if (/\.(png|jpe?g|gif|svg|webp)$/i.test(address)) return false;
  return true;
}

/** mailto: links are prioritized over plain-text regex matches — far less noisy. */
export function extractEmail(html: string): string | null {
  const $ = cheerio.load(html);

  const mailtoAddresses: string[] = [];
  $('a[href^="mailto:"]').each((_, el) => {
    const href = $(el).attr("href");
    if (!href) return;
    const address = href.replace(/^mailto:/i, "").split("?")[0].trim();
    if (address) mailtoAddresses.push(address);
  });
  const validMailto = mailtoAddresses.find(isPlausibleEmail);
  if (validMailto) return validMailto.toLowerCase();

  const text = $.root().text();
  const matches = text.match(EMAIL_REGEX) ?? [];
  const validMatch = matches.find(isPlausibleEmail);
  return validMatch ? validMatch.toLowerCase() : null;
}

export function extractPhone(html: string): string | null {
  const $ = cheerio.load(html);

  const telHref = $('a[href^="tel:"]').first().attr("href");
  if (telHref) {
    const digits = telHref.replace(/^tel:/i, "").trim();
    if (digits) return digits;
  }

  const text = $.root().text();
  const matches = text.match(PHONE_REGEX) ?? [];
  // Prefer a match with a full 10+ digit number over short fragments.
  const candidate = matches.find((match) => match.replace(/\D/g, "").length >= 10);
  return candidate?.trim() ?? null;
}

/** Finds a same-site link whose visible text mentions "contact", if the page has one. */
export function findContactPageLink(html: string, baseUrl: string): string | null {
  const $ = cheerio.load(html);
  let found: string | null = null;

  $("a").each((_, el) => {
    if (found) return;
    const text = $(el).text().trim().toLowerCase();
    const href = $(el).attr("href");
    if (!href || !/\bcontact\b/.test(text)) return;
    try {
      found = new URL(href, baseUrl).toString();
    } catch {
      // unparsable href (e.g. "javascript:void(0)") — ignore
    }
  });

  return found;
}
