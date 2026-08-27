/**
 * Verified against real scrape.do output (a live `s=wireless+mouse` search
 * page and a live product detail page, both fetched 2026-08-25) — see the
 * per-field confidence notes below for what's actually been confirmed vs.
 * still just a best-effort guess. Amazon's DOM still varies by category,
 * locale, and A/B test, so every field lists fallback selectors tried in
 * order until one returns non-empty text/attribute.
 *
 * When scraping breaks, THIS is the file to fix: add a new selector to the
 * relevant array rather than hunting through parse.ts.
 */

// Fairly stable: Amazon has used this data-component hook for search result
// cards (and the data-asin attribute on it) for years.
export const SEARCH_RESULT_CARD = 'div[data-component-type="s-search-result"]';

// Medium confidence: the heading structure has shifted between h2 > a > span
// and h2 > span a few times.
export const SEARCH_RESULT_TITLE = ["h2 a span", "h2 span", "a.a-link-normal .a-text-normal"];

// Medium confidence: the offscreen span reliably holds "$X.XX" even when the
// visible price is split into whole/fraction spans for styling.
export const SEARCH_RESULT_PRICE = ["span.a-price > span.a-offscreen", "span.a-price-whole"];

// Verified: real cards render `<span class="a-icon-alt">4.5 out of 5 stars</span>`.
export const SEARCH_RESULT_RATING = ["span.a-icon-alt", "i.a-icon-star-small span.a-icon-alt"];

// Verified: the precise count lives in an `aria-label="44,709 ratings"`
// attribute on an <a> tag, NOT its visible text (that's abbreviated, e.g.
// "(44.7K)") and NOT a <span> (an earlier version of this file wrongly
// assumed both, which is why review counts were always coming back empty).
// Read the `aria-label` attribute of the match, not its .text().
export const SEARCH_RESULT_REVIEW_COUNT = ['a[aria-label$="ratings"]', 'a[aria-label$="rating"]'];

// Fairly stable.
export const SEARCH_RESULT_IMAGE = ["img.s-image"];

// Medium confidence: "Visit the X Store" / "Brand: X" in the byline. Verified
// live that #bylineInfo/#brand are sometimes simply absent (a page variant
// that only has a "Brand" row in the detail table instead) — parse.ts falls
// back to PRODUCT_DETAIL_TABLE_ROW_SELECTORS + a "Brand" label match in that case.
export const PRODUCT_BYLINE_BRAND = ["#bylineInfo", "#brand", "tr.po-brand td.a-span9 span"];

// Verified: real product pages render specs (including a "Brand" row and,
// when present, "Best Sellers Rank") as <tr><th>Label</th><td>Value</td></tr>
// inside one of several possible tables/containers — table.a-keyvalue.prodDetTable
// confirmed live; the rest are kept as fallbacks for other page variants.
export const PRODUCT_DETAIL_TABLE_ROW_SELECTORS = [
  "table.a-keyvalue.prodDetTable tr",
  "table.prodDetTable tr",
  "#productDetails_techSpec_section_1 tr",
  "#productDetails_detailBullets_sections1 tr",
];

// Lower confidence: rank text format ("#N in Category") is confirmed live,
// but multi-category rank lists or omitted rank on some categories are not
// verified. We search each container's full text for a "Best Sellers Rank"
// phrase rather than relying on exact child structure.
export const PRODUCT_DETAIL_BULLET_CONTAINERS = [
  "table.a-keyvalue.prodDetTable",
  "#productDetails_expanderTables_depthRightSections",
  "#productDetails_expanderSectionTables",
  "#detailBullets_feature_div",
  "#productDetails_detailBullets_sections1",
  "#detailBulletsWrapper_feature_div",
];

export const PRODUCT_CATEGORY_BREADCRUMB = ["#wayfinding-breadcrumbs_feature_div ul"];
