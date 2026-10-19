// The Amazon sites we can scrape. Plain data and helpers with no imports, so
// Client Components (the scrape form, filters) can use them too. Adding a
// marketplace = one entry here + a value in the AmazonMarketplace enum in
// prisma/schema.prisma (with a migration).

export const MARKETPLACE_CODES = ["US", "UK"] as const;
export type MarketplaceCode = (typeof MARKETPLACE_CODES)[number];

export interface MarketplaceInfo {
  code: MarketplaceCode;
  label: string;
  /** Registrable domain, no "www.". */
  domain: string;
  /**
   * scrape.do geotargeting, so pages are fetched the way a shopper in that
   * country sees them. Left out for the US, which is scrape.do's default.
   */
  geoCode?: string;
  /** Used when a price is shown without a currency symbol. */
  currency: string;
}

export const MARKETPLACES: Record<MarketplaceCode, MarketplaceInfo> = {
  US: { code: "US", label: "United States", domain: "amazon.com", currency: "$" },
  UK: { code: "UK", label: "United Kingdom", domain: "amazon.co.uk", geoCode: "gb", currency: "£" },
};

export const DEFAULT_MARKETPLACE: MarketplaceCode = "US";

export function marketplaceHost(code: MarketplaceCode): string {
  return `www.${MARKETPLACES[code].domain}`;
}

/** "us" / "UK" -> the code; anything else (or nothing) -> null. */
export function parseMarketplace(value: unknown): MarketplaceCode | null {
  if (typeof value !== "string") return null;
  const upper = value.trim().toUpperCase();
  return (MARKETPLACE_CODES as readonly string[]).includes(upper) ? (upper as MarketplaceCode) : null;
}

/** Which marketplace an Amazon URL belongs to, or null if it isn't one of ours. */
export function marketplaceFromUrl(url: string): MarketplaceCode | null {
  let hostname: string;
  try {
    hostname = new URL(url).hostname.toLowerCase();
  } catch {
    return null;
  }
  for (const code of MARKETPLACE_CODES) {
    const { domain } = MARKETPLACES[code];
    if (hostname === domain || hostname.endsWith(`.${domain}`)) return code;
  }
  return null;
}
