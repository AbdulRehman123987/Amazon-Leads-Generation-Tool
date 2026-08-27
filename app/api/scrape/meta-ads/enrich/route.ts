import { NextResponse } from "next/server";
import { after } from "next/server";
import { prisma } from "@/lib/db";
import { createScrapeJob } from "@/lib/jobs";
import { runMetaAdsEnrichmentJob } from "@/lib/metaAds/runMetaAdsEnrichmentJob";
import { withErrorHandling } from "@/lib/apiHandler";
import type { Prisma } from "@/lib/generated/prisma/client";
import type {
  ApiErrorResponse,
  MetaAdsEnrichmentInput,
  StartJobResponse,
  StartMetaAdsEnrichmentRequest,
} from "@/lib/types";

export const POST = withErrorHandling(async (request: Request) => {
  let body: StartMetaAdsEnrichmentRequest;
  try {
    body = await request.json();
  } catch {
    const error: ApiErrorResponse = { error: "Invalid JSON body" };
    return NextResponse.json(error, { status: 400 });
  }

  const mode = body.mode === "needs-enrichment" ? "needs-enrichment" : "selected";
  let metaAdBrandIds: string[];

  if (mode === "needs-enrichment") {
    // Same credit-saving rule as Brand enrichment: only never-started (or
    // stuck-in-progress from a crashed run) gets an automatic pass. FOUND,
    // NOT_FOUND, and PARTIAL were all already checked once — leave them out
    // of the automatic sweep so re-running it doesn't keep re-spending
    // credits on brands unlikely to resolve differently. Still retriable one
    // at a time via the per-row retry icon.
    const needsEnrichment = await prisma.metaAdBrand.findMany({
      where: { enrichmentStatus: { notIn: ["FOUND", "NOT_FOUND", "PARTIAL"] } },
      select: { id: true },
    });
    metaAdBrandIds = needsEnrichment.map((b) => b.id);
  } else if (Array.isArray(body.metaAdBrandIds) && body.metaAdBrandIds.length > 0) {
    metaAdBrandIds = body.metaAdBrandIds.filter((id): id is string => typeof id === "string");
  } else {
    const error: ApiErrorResponse = {
      error: 'Provide metaAdBrandIds or mode="needs-enrichment"',
    };
    return NextResponse.json(error, { status: 400 });
  }

  const input: MetaAdsEnrichmentInput = { mode, metaAdBrandIds };
  const job = await createScrapeJob("META_ADS_ENRICHMENT", input as unknown as Prisma.InputJsonValue);

  after(() => runMetaAdsEnrichmentJob(job.id));

  const response: StartJobResponse = { jobId: job.id };
  return NextResponse.json(response, { status: 201 });
});
