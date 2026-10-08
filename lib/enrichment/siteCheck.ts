import * as cheerio from "cheerio";
import { brandNameTokens } from "./pickWebsite";

const PARKED_PHRASES = [
  /\b[a-z0-9-]+\.[a-z]{2,}\s+is\s+for\s+sale\b/i, // "honorthy.com is for sale"
  /\bdomain(\s+name)?\s+(is\s+)?for\s+sale\b/i,
  /\bbuy\s+this\s+domain\b/i,
  /\bthis\s+domain\s+(may\s+be\s+for\s+sale|is\s+(for\s+sale|available|parked))\b/i,
  /\b(hugedomains|afternic|parkingcrew|sedoparking|domain\s+parking)\b/i,
];

/**
 * A registrar/broker placeholder rather than a real business site: a
 * "for sale" page, or the bare redirect shell some parking services serve
 * (`location.href = "/lander..."`).
 */
export function isParkedPage(html: string): boolean {
  if (/location\.href\s*=\s*["']\/lander/i.test(html)) return true;
  const $ = cheerio.load(html);
  $("script, style, noscript").remove();
  const text = `${$("title").text()} ${$("body").text()}`.replace(/\s+/g, " ").slice(0, 3000);
  return PARKED_PHRASES.some((phrase) => phrase.test(text));
}

/**
 * True if a guessed `<brand>.com` plausibly is the brand's own site: not
 * parked, and the brand's name appears in the page's visible text. Occurrences
 * of the domain itself are ignored — every parked or unrelated site "mentions"
 * its own domain (canonical links, "buy this domain" copy), so that alone
 * proves nothing about the brand.
 */
export function pageLooksLikeBrandSite(html: string, brandName: string, domain: string): boolean {
  if (isParkedPage(html)) return false;

  const $ = cheerio.load(html);
  const meta = [
    $('meta[property="og:site_name"]').attr("content"),
    $('meta[property="og:title"]').attr("content"),
    $('meta[name="description"]').attr("content"),
  ];
  $("script, style, noscript, template").remove();

  const text = [$("title").text(), ...meta, $("body").text().slice(0, 20_000)]
    .join(" ")
    .toLowerCase()
    .split(domain.toLowerCase())
    .join(" ");
  return brandNameTokens(brandName).some((token) => text.includes(token));
}
