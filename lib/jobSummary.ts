// Pure, dependency-free job-label helpers — deliberately kept separate from
// lib/jobs.ts (which imports lib/db.ts, a server-only module) so this file
// can be safely imported from Client Components too.
import type { ScrapeJobType } from "@/lib/generated/prisma/client";

/** Short human-readable description of what a job was for — "wireless mouse", "3 brands", etc. */
export function summarizeJobInput(job: { type: ScrapeJobType; input: unknown }): string {
  const input = job.input as Record<string, unknown> | null;
  if (job.type === "AMAZON_SEARCH") {
    const keyword = typeof input?.keyword === "string" ? input.keyword : null;
    if (keyword) return keyword;
    const categoryUrl = typeof input?.categoryUrl === "string" ? input.categoryUrl : null;
    if (categoryUrl) return "category URL";
    return "Amazon search";
  }
  if (job.type === "META_ADS_SEARCH") {
    const keyword = typeof input?.keyword === "string" ? input.keyword : null;
    return keyword ? `"${keyword}" ads` : "Ad Library search";
  }
  if (job.type === "META_ADS_ENRICHMENT") {
    const count = Array.isArray(input?.metaAdBrandIds) ? input.metaAdBrandIds.length : 0;
    return `${count} Ad Library brand${count === 1 ? "" : "s"}`;
  }
  const brandIds = Array.isArray(input?.brandIds) ? input.brandIds.length : 0;
  return `${brandIds} brand${brandIds === 1 ? "" : "s"}`;
}

/** Label for job dropdowns/chips: what it was for, plus when it ran. */
export function jobLabel(job: { type: ScrapeJobType; input: unknown; createdAt: Date }): string {
  const date = job.createdAt.toLocaleDateString(undefined, { month: "short", day: "numeric" });
  return `${summarizeJobInput(job)} — ${date}`;
}
