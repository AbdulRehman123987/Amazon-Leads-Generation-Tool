import type { OrganicResult } from "./googleSearch";

// Marketplaces, socials, and reference sites that are never the brand's own
// official site, even when they rank first for a brand-name search.
const EXCLUDED_HOST_FRAGMENTS = [
  "amazon.",
  "facebook.com",
  "instagram.com",
  "wikipedia.org",
  "twitter.com",
  "x.com",
  "youtube.com",
  "linkedin.com",
  "pinterest.com",
  "tiktok.com",
  "etsy.com",
  "ebay.com",
  "walmart.com",
  "target.com",
  "google.com",
  "yelp.com",
  "bbb.org",
  "crunchbase.com",
  "reddit.com",
];

// Words that show up in brand names but not in the brand's domain.
const NAME_STOP_WORDS = new Set([
  "a", "an", "and", "by", "co", "company", "for", "in", "inc", "llc", "ltd", "of", "on", "or", "the", "to", "with",
]);

/**
 * A candidate's domain must contain at least this share of the brand's name
 * tokens to be picked at all. Without it the top-ranked *unrelated* result
 * (nvidia.com for the brand "1080 Graphics") gets accepted as "the website"
 * and its contact details are saved as the brand's.
 */
export const MIN_TOKEN_MATCH = 0.5;

function isExcludedHost(hostname: string): boolean {
  return EXCLUDED_HOST_FRAGMENTS.some((fragment) => hostname.includes(fragment));
}

export function brandNameTokens(name: string): string[] {
  return name
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((token) => token.length > 1 && !NAME_STOP_WORDS.has(token));
}

/** Share of the brand's name tokens found in the hostname (everything but the TLD, so "shop.brand.co" counts). */
export function tokenMatchScore(brandDisplayName: string, hostname: string): number {
  const tokens = brandNameTokens(brandDisplayName);
  if (tokens.length === 0) return 0;
  const domainLabel = hostname.toLowerCase().split(".").slice(0, -1).join("");
  return tokens.filter((token) => domainLabel.includes(token)).length / tokens.length;
}

export interface WebsiteCandidate {
  url: string;
  confidence: number;
}

export interface WebsiteCandidateDebug extends WebsiteCandidate {
  excluded: boolean;
}

/**
 * Confidence = 0.8 * (fraction of brand-name tokens found in the domain
 * label) + a small bonus for ranking higher among the search engine's own
 * (non-excluded) results, since its ranking is itself a real signal. Tune the
 * 0.8/0.2 split and the per-rank decay below if matches look over/under-confident.
 */
export function scoreCandidate(brandDisplayName: string, hostname: string, rank: number): number {
  const positionBonus = Math.max(0, 0.2 - rank * 0.05);
  return Math.min(1, tokenMatchScore(brandDisplayName, hostname) * 0.8 + positionBonus);
}

export function pickBestCandidate(
  brandDisplayName: string,
  results: OrganicResult[]
): { best: WebsiteCandidate | null; considered: WebsiteCandidateDebug[] } {
  const considered: WebsiteCandidateDebug[] = [];
  let best: WebsiteCandidate | null = null;
  let rank = 0;

  for (const result of results) {
    let hostname: string;
    try {
      hostname = new URL(result.url).hostname.replace(/^www\./, "");
    } catch {
      continue;
    }

    const excluded = isExcludedHost(hostname);
    const url = `https://${hostname}`;

    if (excluded) {
      considered.push({ url, confidence: 0, excluded: true });
      continue;
    }

    const confidence = scoreCandidate(brandDisplayName, hostname, rank);
    considered.push({ url, confidence, excluded: false });
    rank++;

    if (tokenMatchScore(brandDisplayName, hostname) < MIN_TOKEN_MATCH) continue;
    if (!best || confidence > best.confidence) {
      best = { url, confidence };
    }
  }

  return { best, considered };
}
