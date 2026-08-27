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

export interface JobLogEntry {
  timestamp: string; // ISO 8601
  level: "info" | "warn" | "error";
  message: string;
}

export interface AmazonSearchInput {
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
}

// ---- API response bodies ----

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
}

/** One option in the "search" filter dropdown/chips on the Products page. */
export interface JobOption {
  id: string;
  label: string;
  productCount: number;
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
  enrichmentStatus: BrandEnrichmentStatus;
  productCount: number;
  updatedAt: string;
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
}
