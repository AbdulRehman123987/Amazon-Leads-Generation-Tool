import { prisma } from "@/lib/db";
import type { Prisma } from "@/lib/generated/prisma/client";
import { toCsv } from "@/lib/csv";
import { withErrorHandling } from "@/lib/apiHandler";
import { requireUser } from "@/lib/auth/currentUser";
import { isAdmin, ownedBy } from "@/lib/auth/access";

export const GET = withErrorHandling(async (request: Request) => {
  const user = await requireUser();
  const { searchParams } = new URL(request.url);
  const q = searchParams.get("q") ?? "";
  const keyword = searchParams.get("keyword") ?? "";
  const minActiveAdsRaw = searchParams.get("minActiveAds") ?? "";
  const minActiveAds = minActiveAdsRaw ? parseInt(minActiveAdsRaw, 10) : undefined;

  const where: Prisma.MetaAdBrandWhereInput = {
    ...ownedBy(user),
    ...(q ? { pageName: { contains: q, mode: "insensitive" } } : {}),
    ...(keyword ? { searchKeyword: keyword } : {}),
    ...(minActiveAds != null && Number.isFinite(minActiveAds) ? { activeAdCount: { gte: minActiveAds } } : {}),
  };

  const brands = await prisma.metaAdBrand.findMany({
    where,
    orderBy: { activeAdCount: "desc" },
    include: { user: { select: { email: true } } },
  });
  const withOwner = isAdmin(user);

  const headers = [
    "Page name",
    "Page URL",
    "Category",
    "Likes",
    "Search keyword",
    "Active ads",
    "Sample ad text",
    "Website",
    "Email",
    "Phone",
    "Enrichment status",
    "Updated",
    ...(withOwner ? ["Owner"] : []),
  ];
  const rows = brands.map((b) => [
    b.pageName,
    b.pageProfileUri ?? "",
    b.pageCategory ?? "",
    b.pageLikeCount ?? "",
    b.searchKeyword,
    b.activeAdCount,
    b.sampleAdSnippet ?? "",
    b.websiteUrl ?? "",
    b.email ?? "",
    b.phone ?? "",
    b.enrichmentStatus,
    b.updatedAt.toISOString(),
    ...(withOwner ? [b.user?.email ?? ""] : []),
  ]);

  return new Response(toCsv(headers, rows), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": 'attachment; filename="meta-ad-library.csv"',
    },
  });
});
