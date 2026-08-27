import { prisma } from "@/lib/db";
import { BrandEnrichmentStatus, type Prisma } from "@/lib/generated/prisma/client";
import { toCsv } from "@/lib/csv";
import { withErrorHandling } from "@/lib/apiHandler";

const VALID_STATUSES = new Set<string>(Object.values(BrandEnrichmentStatus));

export const GET = withErrorHandling(async (request: Request) => {
  const { searchParams } = new URL(request.url);
  const q = searchParams.get("q") ?? "";
  const statusRaw = searchParams.get("status") ?? "";
  const status = VALID_STATUSES.has(statusRaw) ? (statusRaw as BrandEnrichmentStatus) : undefined;

  const where: Prisma.BrandWhereInput = {
    ...(q
      ? {
          OR: [
            { displayName: { contains: q, mode: "insensitive" } },
            { name: { contains: q.toLowerCase(), mode: "insensitive" } },
          ],
        }
      : {}),
    ...(status ? { enrichmentStatus: status } : {}),
  };

  const brands = await prisma.brand.findMany({
    where,
    orderBy: { updatedAt: "desc" },
    include: { _count: { select: { products: true } } },
  });

  const headers = ["Name", "Website", "Email", "Phone", "Status", "Product Count", "Updated"];
  const rows = brands.map((b) => [
    b.displayName,
    b.websiteUrl ?? "",
    b.email ?? "",
    b.phone ?? "",
    b.enrichmentStatus,
    b._count.products,
    b.updatedAt.toISOString(),
  ]);

  return new Response(toCsv(headers, rows), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": 'attachment; filename="brands.csv"',
    },
  });
});
