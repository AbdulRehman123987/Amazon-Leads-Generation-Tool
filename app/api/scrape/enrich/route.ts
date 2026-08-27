import { NextResponse } from "next/server";
import { after } from "next/server";
import { prisma } from "@/lib/db";
import { createScrapeJob } from "@/lib/jobs";
import { runBrandEnrichmentJob } from "@/lib/enrichment/runEnrichmentJob";
import { withErrorHandling } from "@/lib/apiHandler";
import type { Prisma } from "@/lib/generated/prisma/client";
import type {
  ApiErrorResponse,
  BrandEnrichmentInput,
  StartBrandEnrichmentRequest,
  StartJobResponse,
} from "@/lib/types";

export const POST = withErrorHandling(async (request: Request) => {
  let body: StartBrandEnrichmentRequest;
  try {
    body = await request.json();
  } catch {
    const error: ApiErrorResponse = { error: "Invalid JSON body" };
    return NextResponse.json(error, { status: 400 });
  }

  const mode = body.mode === "needs-enrichment" ? "needs-enrichment" : "selected";
  let brandIds: string[];

  if (mode === "needs-enrichment") {
    // Never-started, partial hits, and any brand stuck IN_PROGRESS from a
    // crashed prior run — worth another pass. Deliberately excludes FOUND
    // (already done) and NOT_FOUND (already tried and came back empty —
    // repeating that automatically in every bulk run just burns scrape.do
    // credits on brands unlikely to resolve differently). A NOT_FOUND brand
    // can still be retried deliberately via its own "Re-run enrichment" button.
    const needsEnrichment = await prisma.brand.findMany({
      where: { enrichmentStatus: { notIn: ["FOUND", "NOT_FOUND"] } },
      select: { id: true },
    });
    brandIds = needsEnrichment.map((b) => b.id);
  } else if (Array.isArray(body.brandIds) && body.brandIds.length > 0) {
    brandIds = body.brandIds.filter((id): id is string => typeof id === "string");
  } else if (Array.isArray(body.productIds) && body.productIds.length > 0) {
    const productIds = body.productIds.filter((id): id is string => typeof id === "string");
    const products = await prisma.product.findMany({
      where: { id: { in: productIds }, brandId: { not: null } },
      select: { brandId: true },
    });
    brandIds = [...new Set(products.map((p) => p.brandId).filter((id): id is string => id != null))];
  } else if (typeof body.jobId === "string" && body.jobId) {
    const products = await prisma.product.findMany({
      where: { scrapeJobId: body.jobId, brandId: { not: null } },
      select: { brandId: true },
    });
    brandIds = [...new Set(products.map((p) => p.brandId).filter((id): id is string => id != null))];
  } else {
    const error: ApiErrorResponse = {
      error: "Provide brandIds, productIds, jobId, or mode=\"needs-enrichment\"",
    };
    return NextResponse.json(error, { status: 400 });
  }

  const input: BrandEnrichmentInput = { mode, brandIds };
  const job = await createScrapeJob("BRAND_ENRICHMENT", input as unknown as Prisma.InputJsonValue);

  after(() => runBrandEnrichmentJob(job.id));

  const response: StartJobResponse = { jobId: job.id };
  return NextResponse.json(response, { status: 201 });
});
