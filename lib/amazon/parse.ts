import * as cheerio from "cheerio";
import * as sel from "./selectors";

export interface RawAmazonSearchItem {
  asin: string;
  title: string;
  url: string;
  imageUrl: string | null;
  price: number | null;
  currency: string | null;
  reviewCount: number | null;
  rating: number | null;
}

export interface RawAmazonProductDetail {
  brandNameRaw: string | null;
  bsr: number | null;
  category: string | null;
}

type CheerioRoot = ReturnType<typeof cheerio.load>;
type CheerioNode = ReturnType<CheerioRoot>;

function firstTextWithin(card: CheerioNode, selectors: string[]): string | null {
  for (const selector of selectors) {
    const text = card.find(selector).first().text().trim();
    if (text) return text;
  }
  return null;
}

function firstText($: CheerioRoot, selectors: string[]): string | null {
  for (const selector of selectors) {
    const text = $(selector).first().text().trim();
    if (text) return text;
  }
  return null;
}

/** Like firstTextWithin, but reads an attribute instead of visible text — the
 * review-count element's visible text is an abbreviated "(44.7K)"; the
 * precise count only lives in its aria-label ("44,709 ratings"). */
function firstAttrWithin(card: CheerioNode, selectors: string[], attr: string): string | null {
  for (const selector of selectors) {
    const value = card.find(selector).first().attr(attr);
    if (value) return value;
  }
  return null;
}

/** Finds a `<tr><th>label</th><td>value</td></tr>`-style row by its label text. */
function findDetailTableValue($: CheerioRoot, rowSelectors: string[], label: string): string | null {
  let result: string | null = null;
  for (const selector of rowSelectors) {
    $(selector).each((_, el) => {
      if (result) return;
      const row = $(el);
      const key = row.find("th").first().text().trim();
      if (key.toLowerCase() === label.toLowerCase()) {
        result = row.find("td").first().text().trim() || null;
      }
    });
    if (result) break;
  }
  return result;
}

function parsePrice(text: string | null): { price: number | null; currency: string | null } {
  if (!text) return { price: null, currency: null };
  const match = text.match(/([^\d\s.,]+)?\s*([\d,]+(?:\.\d+)?)/);
  if (!match) return { price: null, currency: null };
  const price = parseFloat(match[2].replace(/,/g, ""));
  return {
    price: Number.isFinite(price) ? price : null,
    currency: match[1]?.trim() || "$",
  };
}

function parseRating(text: string | null): number | null {
  if (!text) return null;
  const match = text.match(/([\d.]+)\s*out of/i);
  if (!match) return null;
  const rating = parseFloat(match[1]);
  return Number.isFinite(rating) ? rating : null;
}

function parseReviewCount(text: string | null): number | null {
  if (!text) return null;
  const match = text.replace(/,/g, "").match(/\d+/);
  if (!match) return null;
  const count = parseInt(match[0], 10);
  return Number.isFinite(count) ? count : null;
}

/** Parses one Amazon search-results page into raw per-result stubs. */
export function parseAmazonSearchResults(html: string): RawAmazonSearchItem[] {
  const $ = cheerio.load(html);
  const items: RawAmazonSearchItem[] = [];

  $(sel.SEARCH_RESULT_CARD).each((_, el) => {
    const card = $(el);
    const asin = card.attr("data-asin");
    if (!asin) return; // sponsored/placeholder cards without a real ASIN

    const title = firstTextWithin(card, sel.SEARCH_RESULT_TITLE);
    if (!title) return; // unrecognized card layout — nothing usable to store

    const { price, currency } = parsePrice(firstTextWithin(card, sel.SEARCH_RESULT_PRICE));
    const rating = parseRating(firstTextWithin(card, sel.SEARCH_RESULT_RATING));
    const reviewCount = parseReviewCount(
      firstAttrWithin(card, sel.SEARCH_RESULT_REVIEW_COUNT, "aria-label")
    );
    const imageUrl = card.find(sel.SEARCH_RESULT_IMAGE.join(", ")).first().attr("src") ?? null;

    items.push({
      asin,
      title,
      // Built from the ASIN rather than the scraped <a href>, which usually
      // carries sponsored-click tracking query params we don't want to store.
      url: `https://www.amazon.com/dp/${asin}`,
      imageUrl,
      price,
      currency,
      reviewCount,
      rating,
    });
  });

  return items;
}

/** Parses one Amazon product detail page for the fields the search results page doesn't have. */
export function parseAmazonProductPage(html: string): RawAmazonProductDetail {
  const $ = cheerio.load(html);

  const bylineText =
    firstText($, sel.PRODUCT_BYLINE_BRAND) ??
    findDetailTableValue($, sel.PRODUCT_DETAIL_TABLE_ROW_SELECTORS, "Brand");
  const brandNameRaw = bylineText
    ? bylineText
        .replace(/^visit the /i, "")
        .replace(/ store$/i, "")
        .replace(/^brand:\s*/i, "")
        .trim() || null
    : null;

  let bsr: number | null = null;
  for (const containerSelector of sel.PRODUCT_DETAIL_BULLET_CONTAINERS) {
    const container = $(containerSelector);
    if (!container.length) continue;
    const match = container.text().match(/Best Sellers Rank[^\d]*#?\s*([\d,]+)/i);
    if (match) {
      bsr = parseInt(match[1].replace(/,/g, ""), 10);
      break;
    }
  }

  const category = firstText($, sel.PRODUCT_CATEGORY_BREADCRUMB);

  return { brandNameRaw, bsr, category };
}
