import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { BrandEnrichmentStatus, Prisma } from "@/lib/generated/prisma/client";
import { toCsv } from "@/lib/csv";
import { withErrorHandling } from "@/lib/apiHandler";
import { brandExportWhere, primaryProductArgs } from "@/lib/brands";
import type { ApiErrorResponse, ExportBrandsRequest } from "@/lib/types";

const VALID_STATUSES = new Set<string>(Object.values(BrandEnrichmentStatus));

// Postgres allows at most 32767 bind parameters per statement.
const MARK_CHUNK_SIZE = 5000;

// POST rather than GET: exporting changes state (it marks the brands as exported).
export const POST = withErrorHandling(async (request: Request) => {
  let body: ExportBrandsRequest;
  try {
    body = await request.json();
  } catch {
    const error: ApiErrorResponse = { error: "Invalid JSON body" };
    return NextResponse.json(error, { status: 400 });
  }

  const q = typeof body.q === "string" ? body.q : "";
  const status =
    typeof body.status === "string" && VALID_STATUSES.has(body.status)
      ? (body.status as BrandEnrichmentStatus)
      : undefined;

  const brands = await prisma.brand.findMany({
    where: brandExportWhere({ q, status, includeExported: body.includeExported === true }),
    orderBy: { updatedAt: "desc" },
    include: { _count: { select: { products: true } }, products: primaryProductArgs },
  });

  const headers = [
    "Name",
    "Website",
    "Email",
    "Phone",
    "Product URL",
    "Status",
    "Product Count",
    "Updated",
  ];
  const rows = brands.map((b) => [
    b.displayName,
    b.websiteUrl ?? "",
    b.email ?? "",
    b.phone ?? "",
    b.products[0]?.url ?? "",
    b.enrichmentStatus,
    b._count.products,
    b.updatedAt.toISOString(),
  ]);
  const csv = toCsv(headers, rows);

  // Raw SQL on purpose: a typed update would also bump `updatedAt` (the
  // "Updated" column and the list order), and exporting doesn't change a brand.
  // UTC matches how Prisma stores DateTime in a TIMESTAMP(3) column.
  const ids = brands.map((b) => b.id);
  for (let i = 0; i < ids.length; i += MARK_CHUNK_SIZE) {
    await prisma.$executeRaw`
      UPDATE "Brand"
      SET "exportedAt" = (NOW() AT TIME ZONE 'UTC')
      WHERE "id" IN (${Prisma.join(ids.slice(i, i + MARK_CHUNK_SIZE))})
    `;
  }

  const date = new Date().toISOString().slice(0, 10);
  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="brands-${date}.csv"`,
      "X-Export-Count": String(brands.length),
    },
  });
});
