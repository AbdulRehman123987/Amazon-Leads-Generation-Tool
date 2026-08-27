import type { GoogleOrganicResult } from "./googleSearch";

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

function isExcludedHost(hostname: string): boolean {
  return EXCLUDED_HOST_FRAGMENTS.some((fragment) => hostname.includes(fragment));
}

function brandNameTokens(name: string): string[] {
  return name
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((token) => token.length > 1);
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
 * label) + a small bonus for ranking higher among Google's own (non-excluded)
 * results, since Google's ranking is itself a real signal. Tune the 0.8/0.2
 * split and the per-rank decay below if matches look over/under-confident.
 */
export function scoreCandidate(brandDisplayName: string, hostname: string, rank: number): number {
  const tokens = brandNameTokens(brandDisplayName);
  const domainLabel = hostname.split(".")[0]?.toLowerCase() ?? "";
  const matchingTokens = tokens.filter((token) => domainLabel.includes(token));
  const tokenScore = tokens.length > 0 ? matchingTokens.length / tokens.length : 0;
  const positionBonus = Math.max(0, 0.2 - rank * 0.05);
  return Math.min(1, tokenScore * 0.8 + positionBonus);
}

export function pickBestCandidate(
  brandDisplayName: string,
  results: GoogleOrganicResult[]
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
    if (!best || confidence > best.confidence) {
      best = { url, confidence };
    }
    rank++;
  }

  return { best, considered };
}
