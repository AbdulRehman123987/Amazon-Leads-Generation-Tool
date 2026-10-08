import * as cheerio from "cheerio";

const EMAIL_REGEX = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;

// A real phone number is written with separators or brackets (US style), or
// with a leading "+" (international). A bare run of 10 digits is as likely to
// be an ID or timestamp as a phone number, so it never counts.
const US_PHONE = String.raw`(?:\+?1[-.\s]?)?\(?\d{3}\)?[-.\s]\d{3}[-.\s]\d{4}`;
const INTL_PHONE = String.raw`\+\d{1,3}[-.\s]?\(?\d{1,4}\)?(?:[-.\s]?\d{2,4}){2,4}`;
const PHONE_REGEX = new RegExp(`${INTL_PHONE}|${US_PHONE}`, "g");

/** Visible text only — inline scripts/styles are full of IDs, timestamps and email-shaped strings. */
function visibleText($: cheerio.CheerioAPI): string {
  $("script, style, noscript, template").remove();
  return $.root().text();
}

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

  const text = visibleText($);
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

  const text = visibleText($);
  const matches = text.match(PHONE_REGEX) ?? [];
  // Prefer a match with a full 10+ digit number over short fragments.
  const candidate = matches.find((match) => match.replace(/\D/g, "").length >= 10);
  return candidate?.trim() ?? null;
}

/** Finds a same-site link whose visible text mentions "contact", if the page has one. */
export function findContactPageLink(html: string, baseUrl: string): string | null {
  const $ = cheerio.load(html);
  const baseHost = new URL(baseUrl).hostname.replace(/^www\./, "");
  let found: string | null = null;

  $("a").each((_, el) => {
    if (found) return;
    const text = $(el).text().trim().toLowerCase();
    const href = $(el).attr("href");
    if (!href || !/\bcontact\b/.test(text)) return;
    try {
      const resolved = new URL(href, baseUrl);
      // Off-site "contact" links (a registrar's or a form vendor's own page) say nothing about this brand.
      if (resolved.hostname.replace(/^www\./, "") !== baseHost) return;
      found = resolved.toString();
    } catch {
      // unparsable href (e.g. "javascript:void(0)") — ignore
    }
  });

  return found;
}
