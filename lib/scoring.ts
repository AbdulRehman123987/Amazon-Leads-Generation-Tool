/**
 * "Low sale" score: how much a listing looks like an underserved,
 * low-visibility product whose brand would benefit from outreach. Higher
 * score (closer to 1) = fewer reviews and/or a worse (numerically higher)
 * Best Sellers Rank.
 *
 * Review counts and BSR both span multiple orders of magnitude (a handful of
 * reviews vs. tens of thousands; rank #500 vs #500,000), so each is
 * normalized on a LOG scale against the tunable constants below rather than
 * linearly — otherwise a few outlier products would dominate the range.
 *
 * Tuning: raise REVIEW_COUNT_CEILING / the BSR constants to make the score
 * more lenient (more products count as "low sale"); lower them to be
 * stricter. Everything below is a plain 0-1 blend, safe to adjust directly.
 */

// Review count at/above this normalizes to ~0 on the review axis (i.e. "not low-sale").
const REVIEW_COUNT_CEILING = 1000;

// BSR at/better than (numerically below) this normalizes to ~0 (good rank).
const BSR_GOOD_FLOOR = 5_000;
// BSR at/worse than (numerically above) this normalizes to ~1 (poor rank).
const BSR_POOR_CEILING = 500_000;

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}

function reviewCountComponent(reviewCount: number): number {
  const normalized = Math.log10(reviewCount + 1) / Math.log10(REVIEW_COUNT_CEILING + 1);
  return clamp01(1 - normalized);
}

function bsrComponent(bsr: number): number {
  const normalized =
    (Math.log10(bsr) - Math.log10(BSR_GOOD_FLOOR)) /
    (Math.log10(BSR_POOR_CEILING) - Math.log10(BSR_GOOD_FLOOR));
  return clamp01(normalized);
}

/**
 * `bsr` is frequently unknown until the product detail page is fetched — when
 * absent, the score is based on review count alone rather than guessing at
 * a rank. Once both are known they're blended evenly (50/50).
 */
export function computeLowSaleScore(input: {
  reviewCount: number | null;
  bsr: number | null;
}): number {
  const reviewsPart = reviewCountComponent(input.reviewCount ?? 0);

  if (input.bsr == null || input.bsr <= 0) {
    return reviewsPart;
  }

  const bsrPart = bsrComponent(input.bsr);
  return 0.5 * reviewsPart + 0.5 * bsrPart;
}
