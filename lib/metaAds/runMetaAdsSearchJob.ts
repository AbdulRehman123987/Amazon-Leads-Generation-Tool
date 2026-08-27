import { prisma } from "@/lib/db";
import { searchMetaAdLibrary } from "@/lib/searchApi";
import { setJobStatus, setJobTotal, appendJobLog, recordJobItem } from "@/lib/jobs";
import type { MetaAdsSearchInput } from "@/lib/types";

// A broad keyword can match thousands of ads across many pages — cap how far
// we page in before stopping, so one job can't run indefinitely or rack up
// unbounded SearchAPI.io usage. Advertisers already past this many pages of
// results are, by definition, not the top/most-visible ones for the keyword.
const MAX_PAGES = 5;
const INTER_REQUEST_DELAY_MS = 500;

interface AggregatedPage {
  pageName: string;
  pageProfileUri: string | null;
  pageProfilePicture: string | null;
  pageLikeCount: number | null;
  pageCategory: string | null;
  count: number;
  sampleAdSnippet: string | null;
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function runMetaAdsSearchJob(jobId: string): Promise<void> {
  const job = await prisma.scrapeJob.findUnique({ where: { id: jobId } });
  if (!job) return;

  const input = job.input as unknown as MetaAdsSearchInput;

  try {
    await setJobStatus(
      jobId,
      "RUNNING",
      `Searching Meta Ad Library for "${input.keyword}" (${input.minActiveAds}+ active ads)`
    );

    const countsByPage = new Map<string, AggregatedPage>();
    let pageToken: string | undefined;
    let pagesFetched = 0;
    let totalAdsScanned = 0;

    for (let page = 1; page <= MAX_PAGES; page++) {
      await appendJobLog(jobId, `Fetching Ad Library results page ${page}`);

      let result;
      try {
        result = await searchMetaAdLibrary(input.keyword, {
          activeStatus: "active",
          pageToken,
        });
      } catch (err) {
        await appendJobLog(jobId, `Fetch failed on page ${page}: ${(err as Error).message}`, "error");
        break;
      }

      pagesFetched++;
      totalAdsScanned += result.ads.length;
      await appendJobLog(
        jobId,
        `Page ${page}: ${result.ads.length} active ad(s)` +
          (result.totalResults != null ? ` (${result.totalResults} total match "${input.keyword}")` : "")
      );

      for (const ad of result.ads) {
        if (!ad.isActive) continue;
        const existing = countsByPage.get(ad.pageId);
        if (existing) {
          existing.count++;
        } else {
          countsByPage.set(ad.pageId, {
            pageName: ad.pageName,
            pageProfileUri: ad.pageProfileUri,
            pageProfilePicture: ad.pageProfilePicture,
            pageLikeCount: ad.pageLikeCount,
            pageCategory: ad.pageCategory,
            count: 1,
            sampleAdSnippet: ad.bodyText,
          });
        }
      }

      if (!result.nextPageToken) {
        await appendJobLog(jobId, "Reached the end of results");
        break;
      }
      pageToken = result.nextPageToken;

      if (page < MAX_PAGES) {
        await sleep(INTER_REQUEST_DELAY_MS);
      } else {
        await appendJobLog(
          jobId,
          `Reached the ${MAX_PAGES}-page scan limit — more advertisers may exist beyond what was counted`,
          "warn"
        );
      }
    }

    const qualifying = [...countsByPage.entries()].filter(([, data]) => data.count >= input.minActiveAds);
    await appendJobLog(
      jobId,
      `Scanned ${totalAdsScanned} active ad(s) across ${pagesFetched} page(s) from ${countsByPage.size} distinct advertiser(s) — ${qualifying.length} meet the ${input.minActiveAds}+ threshold`
    );
    await setJobTotal(jobId, qualifying.length);

    for (const [pageId, data] of qualifying) {
      try {
        await prisma.metaAdBrand.upsert({
          where: { pageId_searchKeyword: { pageId, searchKeyword: input.keyword } },
          create: {
            pageId,
            pageName: data.pageName,
            pageProfileUri: data.pageProfileUri,
            pageProfilePicture: data.pageProfilePicture,
            pageLikeCount: data.pageLikeCount,
            pageCategory: data.pageCategory,
            searchKeyword: input.keyword,
            activeAdCount: data.count,
            sampleAdSnippet: data.sampleAdSnippet,
            scrapeJobId: jobId,
          },
          update: {
            pageName: data.pageName,
            pageProfileUri: data.pageProfileUri,
            pageProfilePicture: data.pageProfilePicture,
            pageLikeCount: data.pageLikeCount,
            pageCategory: data.pageCategory,
            activeAdCount: data.count,
            sampleAdSnippet: data.sampleAdSnippet,
            scrapeJobId: jobId,
          },
        });
        await recordJobItem(jobId, `${data.pageName} — ${data.count} active ad(s)`);
      } catch (err) {
        await recordJobItem(jobId, `Failed to save "${data.pageName}": ${(err as Error).message}`, {
          isError: true,
        });
      }
    }

    await setJobStatus(
      jobId,
      "COMPLETED",
      `Job finished: ${qualifying.length} advertiser(s) with ${input.minActiveAds}+ active ads`
    );
  } catch (err) {
    await setJobStatus(jobId, "FAILED", `Job failed: ${(err as Error).message}`);
  }
}
