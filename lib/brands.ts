import { prisma } from "@/lib/db";
import type { Brand, BrandEnrichmentStatus, Prisma } from "@/lib/generated/prisma/client";

export function normalizeBrandName(raw: string): string {
  return raw.trim().toLowerCase().replace(/\s+/g, " ");
}

/**
 * Only brands where enrichment found *something* go into an export. NOT_FOUND
 * has nothing to contact, and NOT_STARTED / IN_PROGRESS have no result yet.
 */
export const EXPORTABLE_STATUSES: BrandEnrichmentStatus[] = ["FOUND", "PARTIAL"];

export function brandNameWhere(q: string): Prisma.BrandWhereInput {
  if (!q) return {};
  return {
    OR: [
      { displayName: { contains: q, mode: "insensitive" } },
      { name: { contains: q.toLowerCase(), mode: "insensitive" } },
    ],
  };
}

/** The brands a CSV export contains for the given filters. */
export function brandExportWhere({
  q,
  status,
  includeExported,
}: {
  q: string;
  status?: BrandEnrichmentStatus;
  includeExported: boolean;
}): Prisma.BrandWhereInput {
  return {
    ...brandNameWhere(q),
    // A status filter that isn't exportable (e.g. NOT_FOUND) narrows to nothing.
    enrichmentStatus: status
      ? EXPORTABLE_STATUSES.includes(status)
        ? status
        : { in: [] }
      : { in: EXPORTABLE_STATUSES },
    ...(includeExported ? {} : { exportedAt: null }),
  };
}

/**
 * The one product shown (and exported) as a brand's "Product URL": the
 * strongest lead first (highest low-sale score), newest as the tiebreak.
 */
export const primaryProductArgs = {
  select: { url: true },
  orderBy: [{ lowSaleScore: { sort: "desc", nulls: "last" } }, { createdAt: "desc" }],
  take: 1,
} satisfies Prisma.Brand$productsArgs;

/**
 * Finds a Brand by normalized name, or creates one. Deliberately never
 * touches displayName/website/email/phone on an existing row — those belong
 * to the enrichment step and to manual corrections made in the UI, not to
 * whatever a later Amazon re-scrape happened to read off the byline.
 */
export async function findOrCreateBrand(rawName: string, userId: string | null): Promise<Brand> {
  const name = normalizeBrandName(rawName);
  // Brands are per owner: two people who both find "Anker" each get their own
  // row, with their own enrichment, manual edits and export history.
  const existing = await prisma.brand.findFirst({ where: { userId, name } });
  if (existing) return existing;
  return prisma.brand.create({ data: { name, displayName: rawName.trim(), userId } });
}
