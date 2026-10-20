import { prisma } from "@/lib/db";
import { scrapeDoFetch, ScrapeDoKeyError } from "@/lib/scrapeDo";
import { jobFailureMessage, keySourceNote, resolveApiKey, type KeySource } from "@/lib/apiKeys";
import { parseAmazonSearchResults, parseAmazonProductPage } from "@/lib/amazon/parse";
import { computeLowSaleScore } from "@/lib/scoring";
import { findOrCreateBrand } from "@/lib/brands";
import {
  setJobStatus,
  setJobTotal,
  appendJobLog,
  recordJobItem,
  isJobCancelled,
} from "@/lib/jobs";
import {
  DEFAULT_MARKETPLACE,
  MARKETPLACES,
  marketplaceHost,
  parseMarketplace,
  type MarketplaceCode,
} from "@/lib/amazon/marketplaces";
import type { AmazonSearchInput } from "@/lib/types";
import type { RawAmazonSearchItem } from "@/lib/amazon/parse";

// Small delay between scrape.do calls — considerate of both scrape.do's own
// rate limits and Amazon's, at the cost of a slower job.
const INTER_REQUEST_DELAY_MS = 600;

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function buildSearchPageUrl(input: AmazonSearchInput, marketplace: MarketplaceCode, page: number): string {
  const base =
    input.categoryUrl?.trim() ||
    `https://${marketplaceHost(marketplace)}/s?k=${encodeURIComponent(input.keyword?.trim() ?? "")}`;
  const url = new URL(base);
  url.searchParams.set("page", String(page));
  return url.toString();
}

/**
 * Runs an AMAZON_SEARCH job end to end: paginated search-results discovery,
 * then a per-product detail fetch for brand/BSR, saving Product rows and
 * matching/creating Brand rows as it goes — all owned by whoever started the
 * job. Designed to survive individual page/item failures — only a fatal,
 * unexpected error fails the whole job. Checks between pages and products
 * whether the job was stopped, and if so keeps what it has and returns. Runs
 * on its owner's own scrape.do key when they saved one (else the shared key);
 * if scrape.do refuses the key the job stops there — every other request would
 * fail the same way — and says so.
 */
export async function runAmazonSearchJob(jobId: string): Promise<void> {
  const job = await prisma.scrapeJob.findUnique({ where: { id: jobId } });
  if (!job) return;
  const userId = job.userId;

  const input = job.input as unknown as AmazonSearchInput;
  // Jobs from before marketplaces existed carry none, and were all amazon.com.
  const marketplace = parseMarketplace(input.marketplace) ?? DEFAULT_MARKETPLACE;
  const site = MARKETPLACES[marketplace];
  // Fetch pages the way a shopper in that country sees them (UK prices, UK listings).
  const fetchOptions = { render: true, ...(site.geoCode ? { geoCode: site.geoCode } : {}) };
  let keySource: KeySource = "shared";

  async function wasStopped(): Promise<boolean> {
    if (!(await isJobCancelled(jobId))) return false;
    await appendJobLog(jobId, "Stopped — what was found so far is kept", "warn");
    return true;
  }

  try {
    if (await isJobCancelled(jobId)) return; // stopped before it even started

    const resolved = await resolveApiKey("scrapeDo", userId);
    const apiKey = resolved.key;
    keySource = resolved.source;

    await setJobStatus(
      jobId,
      "RUNNING",
      `Starting Amazon search on ${site.domain}: ${input.keyword ? `keyword "${input.keyword}"` : input.categoryUrl} (${input.maxPages} page(s))`
    );
    await appendJobLog(jobId, keySourceNote("scrapeDo", keySource));

    // Phase 1: discover candidates across all requested pages before doing
    // any per-item work, so the progress bar reflects real % of total work
    // instead of growing totalItems mid-run.
    const candidatesByAsin = new Map<string, RawAmazonSearchItem>();

    for (let page = 1; page <= input.maxPages; page++) {
      if (await wasStopped()) return;

      const searchUrl = buildSearchPageUrl(input, marketplace, page);
      await appendJobLog(jobId, `Fetching search page ${page}/${input.maxPages}`);

      try {
        const { html } = await scrapeDoFetch(searchUrl, apiKey, fetchOptions);
        const items = parseAmazonSearchResults(html, marketplace);
        await appendJobLog(jobId, `Parsed ${items.length} result(s) from page ${page}`);

        for (const item of items) {
          if (input.maxReviews != null && item.reviewCount != null && item.reviewCount > input.maxReviews) {
            continue; // exceeds the review-count ceiling for "low sale" — skip before spending a detail-page fetch
          }
          candidatesByAsin.set(item.asin, item);
        }
      } catch (err) {
        if (err instanceof ScrapeDoKeyError) throw err;
        await appendJobLog(
          jobId,
          `Failed to fetch/parse search page ${page}: ${(err as Error).message}`,
          "error"
        );
      }

      if (page < input.maxPages) await sleep(INTER_REQUEST_DELAY_MS);
    }

    const candidates = [...candidatesByAsin.values()];
    await setJobTotal(jobId, candidates.length);
    await appendJobLog(jobId, `${candidates.length} candidate product(s) to process`);

    // Phase 2: fetch each candidate's detail page for brand + BSR, score it,
    // and save it. Errors here are per-item — logged, counted, and skipped.
    for (const item of candidates) {
      if (await wasStopped()) return;

      try {
        const { html } = await scrapeDoFetch(item.url, apiKey, fetchOptions);
        const detail = parseAmazonProductPage(html);

        const bsrOutOfRange =
          detail.bsr != null &&
          ((input.minBsr != null && detail.bsr < input.minBsr) ||
            (input.maxBsr != null && detail.bsr > input.maxBsr));

        if (bsrOutOfRange) {
          await recordJobItem(jobId, `Skipped ${item.asin} — BSR ${detail.bsr} outside requested range`);
          await sleep(INTER_REQUEST_DELAY_MS);
          continue;
        }

        const brand = detail.brandNameRaw ? await findOrCreateBrand(detail.brandNameRaw, userId) : null;
        const lowSaleScore = computeLowSaleScore({ reviewCount: item.reviewCount, bsr: detail.bsr });

        const fields = {
          title: item.title,
          url: item.url,
          imageUrl: item.imageUrl,
          price: item.price,
          currency: item.currency,
          reviewCount: item.reviewCount,
          rating: item.rating,
          bsr: detail.bsr,
          category: detail.category,
          brandNameRaw: detail.brandNameRaw,
          lowSaleScore,
          scrapeJobId: jobId,
        };

        // A product is unique per owner and marketplace: the same ASIN found by
        // another user, or on amazon.co.uk, is its own row. Look it up first
        // rather than upserting, because the owner can be null (an account that
        // was deleted) and Prisma can't use a null in a compound unique key.
        const existing = await prisma.product.findFirst({
          where: { userId, asin: item.asin, marketplace },
          select: { id: true },
        });
        if (existing) {
          await prisma.product.update({
            where: { id: existing.id },
            data: { ...fields, ...(brand ? { brandId: brand.id } : {}) },
          });
        } else {
          await prisma.product.create({
            data: { ...fields, asin: item.asin, marketplace, userId, brandId: brand?.id },
          });
        }

        await recordJobItem(
          jobId,
          `Processed ${item.asin} — "${item.title.slice(0, 60)}" — score ${lowSaleScore.toFixed(2)}`
        );
      } catch (err) {
        if (err instanceof ScrapeDoKeyError) throw err;
        await recordJobItem(jobId, `Failed on ${item.asin}: ${(err as Error).message}`, {
          isError: true,
        });
      }

      await sleep(INTER_REQUEST_DELAY_MS);
    }

    await setJobStatus(jobId, "COMPLETED", `Job finished: ${candidates.length} product(s) processed`);
  } catch (err) {
    await setJobStatus(jobId, "FAILED", `Job failed: ${jobFailureMessage(err, "scrapeDo", keySource)}`);
  }
}
