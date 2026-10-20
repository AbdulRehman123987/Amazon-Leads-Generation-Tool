import { NextResponse } from "next/server";
import { after } from "next/server";
import { createScrapeJob } from "@/lib/jobs";
import { runMetaAdsSearchJob } from "@/lib/metaAds/runMetaAdsSearchJob";
import { withErrorHandling } from "@/lib/apiHandler";
import { requireUser } from "@/lib/auth/currentUser";
import { resolveApiKey } from "@/lib/apiKeys";
import type { Prisma } from "@/lib/generated/prisma/client";
import type {
  ApiErrorResponse,
  MetaAdsSearchInput,
  StartJobResponse,
  StartMetaAdsSearchRequest,
} from "@/lib/types";

export const POST = withErrorHandling(async (request: Request) => {
  const user = await requireUser();
  // Tell them now, not from the job's log, if there is no SearchAPI.io key to run on.
  await resolveApiKey("searchApi", user.id);

  let body: StartMetaAdsSearchRequest;
  try {
    body = await request.json();
  } catch {
    const error: ApiErrorResponse = { error: "Invalid JSON body" };
    return NextResponse.json(error, { status: 400 });
  }

  const keyword = typeof body.keyword === "string" ? body.keyword.trim() : "";
  if (!keyword) {
    const error: ApiErrorResponse = { error: "Provide a product/keyword to search for" };
    return NextResponse.json(error, { status: 400 });
  }

  const minActiveAdsRaw =
    typeof body.minActiveAds === "number" ? body.minActiveAds : parseInt(String(body.minActiveAds), 10);
  const minActiveAds = Number.isFinite(minActiveAdsRaw) && minActiveAdsRaw > 0 ? Math.trunc(minActiveAdsRaw) : 1;

  const input: MetaAdsSearchInput = { keyword, minActiveAds };
  const job = await createScrapeJob("META_ADS_SEARCH", input as unknown as Prisma.InputJsonValue, user.id);

  after(() => runMetaAdsSearchJob(job.id));

  const response: StartJobResponse = { jobId: job.id };
  return NextResponse.json(response, { status: 201 });
});
