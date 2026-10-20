/**
 * Shared shapes for job input/log payloads and API request/response bodies.
 * Centralized so route handlers, the job runners, and client components all
 * import from one place instead of redefining these ad hoc.
 */
import type {
  BrandEnrichmentStatus,
  ScrapeJobStatus,
  ScrapeJobType,
} from "@/lib/generated/prisma/client";
import type { MarketplaceCode } from "@/lib/amazon/marketplaces";

/** Why scrape.do or SearchAPI.io turned a request away because of the API key itself. */
export type ApiKeyProblem = "invalid" | "no-credits";

/**
 * Where one of a person's API keys stands: "own" = they saved one; "shared" =
 * none saved, the team's shared key is used; "required" = none saved and they
 * must add one; "missing" = none saved and there is no shared key either;
 * "unreadable" = one is saved but can't be decrypted any more.
 */
export type ApiKeyState = "own" | "shared" | "required" | "missing" | "unreadable";

export interface JobLogEntry {
  timestamp: string; // ISO 8601
  level: "info" | "warn" | "error";
  message: string;
}

export interface AmazonSearchInput {
  /** Which Amazon site to scrape; jobs started before this existed have none and mean the US. */
  marketplace?: MarketplaceCode;
  keyword?: string;
  categoryUrl?: string;
  maxPages: number;
  maxReviews?: number;
  minBsr?: number;
  maxBsr?: number;
}

export interface BrandEnrichmentInput {
  mode: "selected" | "needs-enrichment";
  brandIds: string[];
}

export interface MetaAdsSearchInput {
  keyword: string;
  minActiveAds: number;
}

export interface MetaAdsEnrichmentInput {
  mode: "selected" | "needs-enrichment";
  metaAdBrandIds: string[];
}

// ---- API request bodies ----

export interface StartAmazonScrapeRequest {
  /** "US" (amazon.com, the default) or "UK" (amazon.co.uk). */
  marketplace?: string;
  keyword?: string;
  categoryUrl?: string;
  maxPages?: number;
  maxReviews?: number;
  minBsr?: number;
  maxBsr?: number;
}

export interface StartBrandEnrichmentRequest {
  brandIds?: string[];
  productIds?: string[];
  /** Enrich every brand found among this job's products (the "Enrich brands for these results" button). */
  jobId?: string;
  mode?: "selected" | "needs-enrichment";
}

export interface StartMetaAdsSearchRequest {
  keyword?: string;
  minActiveAds?: number;
}

export interface StartMetaAdsEnrichmentRequest {
  metaAdBrandIds?: string[];
  mode?: "selected" | "needs-enrichment";
}

export interface UpdateBrandRequest {
  displayName?: string;
  websiteUrl?: string | null;
  email?: string | null;
  phone?: string | null;
  /**
   * Set by hand after researching the brand (see lib/brandStatus.ts). Left out,
   * the status follows the contact details: a website and an email -> FOUND,
   * only one of them -> PARTIAL.
   */
  enrichmentStatus?: string;
}

/** Saves (or replaces) the signed-in person's own key for one service. */
export interface SaveApiKeyRequest {
  /** "scrapeDo" or "searchApi". */
  kind: string;
  key: string;
}

export interface RemoveApiKeyRequest {
  kind: string;
}

// ---- API response bodies ----

export interface SaveApiKeyResponse {
  ok: true;
  /** "••••1234" — the only part of a saved key that is ever shown again. */
  hint: string;
  /** The service confirmed the key; false when it couldn't be reached to check. */
  verified: boolean;
  /** Credits the service says are left, when it said. */
  creditsLeft: number | null;
}

export interface StartJobResponse {
  jobId: string;
}

export interface ApiErrorResponse {
  error: string;
}

export interface JobSummary {
  id: string;
  type: ScrapeJobType;
  status: ScrapeJobStatus;
  progress: number;
  totalItems: number;
  processedItems: number;
  errorCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface JobDetail extends JobSummary {
  input: Record<string, unknown>;
  logs: JobLogEntry[];
}

export interface ProductRow {
  id: string;
  asin: string;
  marketplace: MarketplaceCode;
  title: string;
  url: string;
  imageUrl: string | null;
  price: number | null;
  currency: string | null;
  reviewCount: number | null;
  bsr: number | null;
  category: string | null;
  lowSaleScore: number | null;
  scrapeJobId: string;
  brand: { id: string; displayName: string; enrichmentStatus: BrandEnrichmentStatus } | null;
  /** Whose product it is — only filled in for an admin, who sees everyone's. */
  ownerEmail?: string | null;
}

/** One option in the "search" filter dropdown/chips on the Products and Brands pages. */
export interface JobOption {
  id: string;
  label: string;
  /** Products (on Products) or brands (on Brands) found in that search. */
  count: number;
}

/** One row on the Jobs (search history) index page. */
export interface JobListItem extends JobSummary {
  inputSummary: string;
  productCount: number;
}

export interface BrandSummary {
  id: string;
  name: string;
  displayName: string;
  websiteUrl: string | null;
  email: string | null;
  phone: string | null;
  /** The brand's strongest-lead product listing; null if it has no products. */
  productUrl: string | null;
  enrichmentStatus: BrandEnrichmentStatus;
  productCount: number;
  /** The searches (scrape jobs) this brand was found in, newest first. */
  searches: { jobId: string; label: string }[];
  /** When the brand last went out in a CSV export; null = never exported. */
  exportedAt: string | null;
  updatedAt: string;
  /** Whose brand it is — only filled in for an admin, who sees everyone's. */
  ownerEmail?: string | null;
}

export interface ExportBrandsRequest {
  q?: string;
  status?: string;
  /** Only brands found in this search (scrape job). */
  jobId?: string;
  /** Re-export brands that already went out before. Default: skip them. */
  includeExported?: boolean;
}

export interface MetaAdBrandRow {
  id: string;
  pageId: string;
  pageName: string;
  pageProfileUri: string | null;
  pageProfilePicture: string | null;
  pageLikeCount: number | null;
  pageCategory: string | null;
  searchKeyword: string;
  activeAdCount: number;
  sampleAdSnippet: string | null;
  websiteUrl: string | null;
  email: string | null;
  phone: string | null;
  enrichmentStatus: BrandEnrichmentStatus;
  updatedAt: string;
  /** Whose row it is — only filled in for an admin, who sees everyone's. */
  ownerEmail?: string | null;
}
