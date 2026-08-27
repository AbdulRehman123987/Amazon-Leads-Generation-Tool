import { NextResponse } from "next/server";
import { after } from "next/server";
import { createScrapeJob } from "@/lib/jobs";
import { runAmazonSearchJob } from "@/lib/amazon/runSearchJob";
import { withErrorHandling } from "@/lib/apiHandler";
import type { Prisma } from "@/lib/generated/prisma/client";
import type {
  AmazonSearchInput,
  ApiErrorResponse,
  StartAmazonScrapeRequest,
  StartJobResponse,
} from "@/lib/types";

function clampInt(value: unknown, min: number, max: number, fallback: number): number {
  const n = typeof value === "number" ? value : parseInt(String(value), 10);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, Math.trunc(n)));
}

function positiveIntOrUndefined(value: unknown): number | undefined {
  if (value == null || value === "") return undefined;
  const n = typeof value === "number" ? value : parseInt(String(value), 10);
  return Number.isFinite(n) && n >= 0 ? Math.trunc(n) : undefined;
}

export const POST = withErrorHandling(async (request: Request) => {
  let body: StartAmazonScrapeRequest;
  try {
    body = await request.json();
  } catch {
    const error: ApiErrorResponse = { error: "Invalid JSON body" };
    return NextResponse.json(error, { status: 400 });
  }

  const keyword = typeof body.keyword === "string" ? body.keyword.trim() : "";
  const categoryUrl = typeof body.categoryUrl === "string" ? body.categoryUrl.trim() : "";

  if (!keyword && !categoryUrl) {
    const error: ApiErrorResponse = { error: "Provide either a keyword or a category URL" };
    return NextResponse.json(error, { status: 400 });
  }

  if (categoryUrl) {
    try {
      const parsed = new URL(categoryUrl);
      if (!parsed.hostname.endsWith("amazon.com")) {
        const error: ApiErrorResponse = { error: "Category URL must be an amazon.com URL" };
        return NextResponse.json(error, { status: 400 });
      }
    } catch {
      const error: ApiErrorResponse = { error: "Category URL is not a valid URL" };
      return NextResponse.json(error, { status: 400 });
    }
  }

  const maxPages = clampInt(body.maxPages, 1, 10, 1);
  const maxReviews = positiveIntOrUndefined(body.maxReviews);
  const minBsr = positiveIntOrUndefined(body.minBsr);
  const maxBsr = positiveIntOrUndefined(body.maxBsr);

  if (minBsr != null && maxBsr != null && minBsr > maxBsr) {
    const error: ApiErrorResponse = { error: "minBsr cannot be greater than maxBsr" };
    return NextResponse.json(error, { status: 400 });
  }

  const input: AmazonSearchInput = {
    maxPages,
    ...(keyword ? { keyword } : {}),
    ...(categoryUrl ? { categoryUrl } : {}),
    ...(maxReviews != null ? { maxReviews } : {}),
    ...(minBsr != null ? { minBsr } : {}),
    ...(maxBsr != null ? { maxBsr } : {}),
  };

  const job = await createScrapeJob(
    "AMAZON_SEARCH",
    input as unknown as Prisma.InputJsonValue
  );

  after(() => runAmazonSearchJob(job.id));

  const response: StartJobResponse = { jobId: job.id };
  return NextResponse.json(response, { status: 201 });
});
