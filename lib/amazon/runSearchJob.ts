import { prisma } from "@/lib/db";
import { scrapeDoFetch } from "@/lib/scrapeDo";
import { parseAmazonSearchResults, parseAmazonProductPage } from "@/lib/amazon/parse";
import { computeLowSaleScore } from "@/lib/scoring";
import { findOrCreateBrand } from "@/lib/brands";
import { setJobStatus, setJobTotal, appendJobLog, recordJobItem } from "@/lib/jobs";
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
 * then a per-product detail fetch for brand/BSR, upserting Product rows and
 * matching/creating Brand rows as it goes. Designed to survive individual
 * page/item failures — only a fatal, unexpected error fails the whole job.
 */
export async function runAmazonSearchJob(jobId: string): Promise<void> {
  const job = await prisma.scrapeJob.findUnique({ where: { id: jobId } });
  if (!job) return;

  const input = job.input as unknown as AmazonSearchInput;
  // Jobs from before marketplaces existed carry none, and were all amazon.com.
  const marketplace = parseMarketplace(input.marketplace) ?? DEFAULT_MARKETPLACE;
  const site = MARKETPLACES[marketplace];
  // Fetch pages the way a shopper in that country sees them (UK prices, UK listings).
  const fetchOptions = { render: true, ...(site.geoCode ? { geoCode: site.geoCode } : {}) };

  try {
    await setJobStatus(
      jobId,
      "RUNNING",
      `Starting Amazon search on ${site.domain}: ${input.keyword ? `keyword "${input.keyword}"` : input.categoryUrl} (${input.maxPages} page(s))`
    );

    // Phase 1: discover candidates across all requested pages before doing
    // any per-item work, so the progress bar reflects real % of total work
    // instead of growing totalItems mid-run.
    const candidatesByAsin = new Map<string, RawAmazonSearchItem>();

    for (let page = 1; page <= input.maxPages; page++) {
      const searchUrl = buildSearchPageUrl(input, marketplace, page);
      await appendJobLog(jobId, `Fetching search page ${page}/${input.maxPages}`);

      try {
        const { html } = await scrapeDoFetch(searchUrl, fetchOptions);
        const items = parseAmazonSearchResults(html, marketplace);
        await appendJobLog(jobId, `Parsed ${items.length} result(s) from page ${page}`);

        for (const item of items) {
          if (input.maxReviews != null && item.reviewCount != null && item.reviewCount > input.maxReviews) {
            continue; // exceeds the review-count ceiling for "low sale" — skip before spending a detail-page fetch
          }
          candidatesByAsin.set(item.asin, item);
        }
      } catch (err) {
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
    // and upsert. Errors here are per-item — logged, counted, and skipped.
    for (const item of candidates) {
      try {
        const { html } = await scrapeDoFetch(item.url, fetchOptions);
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

        const brand = detail.brandNameRaw ? await findOrCreateBrand(detail.brandNameRaw) : null;
        const lowSaleScore = computeLowSaleScore({ reviewCount: item.reviewCount, bsr: detail.bsr });

        await prisma.product.upsert({
          // An ASIN is unique per marketplace: the same product on amazon.co.uk is its own row.
          where: { asin_marketplace: { asin: item.asin, marketplace } },
          create: {
            asin: item.asin,
            marketplace,
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
            brandId: brand?.id,
          },
          update: {
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
            ...(brand ? { brandId: brand.id } : {}),
          },
        });

        await recordJobItem(
          jobId,
          `Processed ${item.asin} — "${item.title.slice(0, 60)}" — score ${lowSaleScore.toFixed(2)}`
        );
      } catch (err) {
        await recordJobItem(jobId, `Failed on ${item.asin}: ${(err as Error).message}`, {
          isError: true,
        });
      }

      await sleep(INTER_REQUEST_DELAY_MS);
    }

    await setJobStatus(jobId, "COMPLETED", `Job finished: ${candidates.length} product(s) processed`);
  } catch (err) {
    await setJobStatus(jobId, "FAILED", `Job failed: ${(err as Error).message}`);
  }
}
