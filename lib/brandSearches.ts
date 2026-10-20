import { prisma } from "@/lib/db";
import { jobLabel } from "@/lib/jobSummary";

export interface BrandSearch {
  jobId: string;
  /** e.g. "wireless mouse (UK) — Oct 19" */
  label: string;
}

/**
 * For each brand, the searches (scrape jobs) its products were found in, newest
 * first — so people can tell which results a brand came from.
 */
export async function searchesForBrands(brandIds: string[]): Promise<Map<string, BrandSearch[]>> {
  const byBrand = new Map<string, BrandSearch[]>();
  if (brandIds.length === 0) return byBrand;

  const rows = await prisma.product.findMany({
    where: { brandId: { in: brandIds } },
    select: {
      brandId: true,
      scrapeJobId: true,
      scrapeJob: { select: { id: true, type: true, input: true, createdAt: true } },
    },
    distinct: ["brandId", "scrapeJobId"],
  });
  rows.sort((a, b) => b.scrapeJob.createdAt.getTime() - a.scrapeJob.createdAt.getTime());

  for (const row of rows) {
    if (!row.brandId) continue;
    const list = byBrand.get(row.brandId) ?? [];
    list.push({ jobId: row.scrapeJob.id, label: jobLabel(row.scrapeJob) });
    byBrand.set(row.brandId, list);
  }
  return byBrand;
}
