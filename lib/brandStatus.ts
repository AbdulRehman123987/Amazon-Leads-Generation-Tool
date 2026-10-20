// Pure, dependency-free so the brand edit form (a Client Component) and the API
// route can share it.
import type { BrandEnrichmentStatus } from "@/lib/generated/prisma/client";

/**
 * The statuses a person can set by hand after researching a brand themselves.
 * (IN_PROGRESS is only ever set by a running enrichment job.)
 */
export const MANUAL_BRAND_STATUSES = ["NOT_STARTED", "FOUND", "PARTIAL", "NOT_FOUND"] as const satisfies readonly BrandEnrichmentStatus[];

export type ManualBrandStatus = (typeof MANUAL_BRAND_STATUSES)[number];

export const MANUAL_STATUS_HINTS: Record<ManualBrandStatus, string> = {
  NOT_STARTED: "Not looked up yet",
  FOUND: "Website and email found",
  PARTIAL: "Only a website or only an email found",
  NOT_FOUND: "Looked everywhere, nothing found",
};

export function isManualBrandStatus(value: unknown): value is ManualBrandStatus {
  return typeof value === "string" && (MANUAL_BRAND_STATUSES as readonly string[]).includes(value);
}

/**
 * FOUND if both a website and an email were found, PARTIAL if only one.
 * With nothing found, NOT_FOUND — unless part of the lookup couldn't run
 * (`incomplete`), in which case the brand stays NOT_STARTED so the next
 * enrichment sweep retries it instead of recording a false "not found".
 */
export function computeEnrichmentStatus(
  websiteUrl: string | null,
  email: string | null,
  incomplete = false
): BrandEnrichmentStatus {
  if (websiteUrl && email) return "FOUND";
  if (websiteUrl || email) return "PARTIAL";
  return incomplete ? "NOT_STARTED" : "NOT_FOUND";
}
