import { prisma } from "@/lib/db";
import { BrandEnrichmentStatus, type Prisma } from "@/lib/generated/prisma/client";
import { toCsv } from "@/lib/csv";
import { withErrorHandling } from "@/lib/apiHandler";
import { requireUser } from "@/lib/auth/currentUser";
import { isAdmin, ownedBy } from "@/lib/auth/access";
import { parseMarketplace } from "@/lib/amazon/marketplaces";

const VALID_BRAND_STATUSES = new Set<string>(Object.values(BrandEnrichmentStatus));

// Exports the full filtered set (same filters as /products), not just the
// current page — that's the useful behavior for a lead-outreach CSV export.
export const GET = withErrorHandling(async (request: Request) => {
  const user = await requireUser();
  const { searchParams } = new URL(request.url);
  const q = searchParams.get("q") ?? "";
  const marketplace = parseMarketplace(searchParams.get("marketplace")) ?? undefined;
  const brandStatusRaw = searchParams.get("brandStatus") ?? "";
  const brandStatus = VALID_BRAND_STATUSES.has(brandStatusRaw)
    ? (brandStatusRaw as BrandEnrichmentStatus)
    : undefined;
  const minScore = searchParams.get("minScore") ?? "";
  const maxScore = searchParams.get("maxScore") ?? "";

  const where: Prisma.ProductWhereInput = {
    ...ownedBy(user),
    ...(q ? { title: { contains: q, mode: "insensitive" } } : {}),
    ...(marketplace ? { marketplace } : {}),
    ...(minScore || maxScore
      ? {
          lowSaleScore: {
            ...(minScore ? { gte: parseFloat(minScore) } : {}),
            ...(maxScore ? { lte: parseFloat(maxScore) } : {}),
          },
        }
      : {}),
    ...(brandStatus ? { brand: { enrichmentStatus: brandStatus } } : {}),
  };

  const products = await prisma.product.findMany({
    where,
    orderBy: { lowSaleScore: "desc" },
    include: {
      brand: { select: { displayName: true, enrichmentStatus: true, email: true, websiteUrl: true } },
      user: { select: { email: true } },
    },
  });
  const withOwner = isAdmin(user);

  const headers = [
    "ASIN",
    "Marketplace",
    "Title",
    "URL",
    "Price",
    "Currency",
    "Reviews",
    "BSR",
    "Low Sale Score",
    "Brand",
    "Brand Status",
    "Brand Email",
    "Brand Website",
    ...(withOwner ? ["Owner"] : []),
  ];
  const rows = products.map((p) => [
    p.asin,
    p.marketplace,
    p.title,
    p.url,
    p.price ?? "",
    p.currency ?? "",
    p.reviewCount ?? "",
    p.bsr ?? "",
    p.lowSaleScore ?? "",
    p.brand?.displayName ?? "",
    p.brand?.enrichmentStatus ?? "",
    p.brand?.email ?? "",
    p.brand?.websiteUrl ?? "",
    ...(withOwner ? [p.user?.email ?? ""] : []),
  ]);

  return new Response(toCsv(headers, rows), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": 'attachment; filename="products.csv"',
    },
  });
});
