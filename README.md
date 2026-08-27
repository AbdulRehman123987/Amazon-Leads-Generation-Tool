# Amazon Lead Scraper

Finds low-performing Amazon products, identifies their brand, discovers the
brand's company website via Google, and extracts a contact email/phone —
building a lead list for outreach.

## Stack

- Next.js (App Router) + TypeScript
- Prisma ORM + PostgreSQL — works with any Postgres-compatible provider (local
  Postgres, Supabase, Neon) via `DATABASE_URL`
- Tailwind CSS
- All outbound fetching (Amazon pages, Google search pages, brand websites)
  goes through [scrape.do](https://scrape.do) via `lib/scrapeDo.ts`
- Background jobs: an in-process job runner (no Redis/queue service) with
  progress persisted to the `ScrapeJob` table and polled by the UI

## Environment variables

Copy `.env.example` to `.env.local` and fill in:

| Variable | Required | Purpose |
| --- | --- | --- |
| `DATABASE_URL` | yes | Postgres connection string |
| `SCRAPE_DO_API_KEY` | yes | Used for every outbound fetch (see `lib/scrapeDo.ts`) |
| `HUNTER_API_KEY` | no | Reserved for a future Hunter.io email-lookup provider (see below) — unused today |
| `GOOGLE_CSE_API_KEY` / `GOOGLE_CSE_CX` | no | Reserved for an alternative to scraping Google directly — unused today |
| `SEARCHAPI_API_KEY` | only for the Ad Library page | [SearchAPI.io](https://www.searchapi.io/) key, used by `lib/searchApi.ts` for the Meta Ad Library search |

## Getting started

```bash
npm install
npx prisma migrate deploy
npm run dev
```

`npm install` also runs `prisma generate` (via a `postinstall` script).

**Prisma CLI note:** Prisma 7 moved the database connection string out of
`schema.prisma` and into `prisma.config.ts`, which loads it from a plain
`.env` file via `dotenv/config` — separately from how Next.js loads
`.env.local` for the running app. If you only put `DATABASE_URL` in
`.env.local`, `next dev`/`next build` will pick it up fine, but standalone
`prisma migrate` / `prisma studio` commands won't see it unless you also put
it in a plain `.env` file (or export it in your shell first). Easiest fix:
keep the same value in both `.env.local` and `.env`.

Going forward, use `npx prisma migrate dev` (not `deploy`) whenever you change
`prisma/schema.prisma` — it generates and applies a new migration.

## How `lowSaleScore` is computed

See `lib/scoring.ts`. It blends two 0–1 components, each normalized on a
**log** scale — review counts and BSR both span multiple orders of magnitude,
so a linear scale would be dominated by outliers:

- **Review count** — fewer reviews scores closer to 1. Reaches ~0 once review
  count hits `REVIEW_COUNT_CEILING` (default 1,000).
- **BSR** — a numerically higher (worse) rank scores closer to 1. Reaches ~0 at
  `BSR_GOOD_FLOOR` (default 5,000) and ~1 at `BSR_POOR_CEILING` (default
  500,000).

If BSR isn't known yet (it's fetched from the product detail page, not the
search results page), the score is the review-count component alone; once
both are known they're blended 50/50. All the constants above live at the top
of `lib/scoring.ts` — edit them directly to tune how aggressively a product
counts as "low sale".

## Amazon/Google selectors — not verified against live output

`lib/amazon/selectors.ts` and `lib/enrichment/googleSearch.ts` were written
from general knowledge of Amazon's and Google's markup, not a real scrape.do
response — both sites vary their DOM by category, locale, and A/B test. Each
field lists fallback selectors tried in order (see the confidence notes in
`lib/amazon/selectors.ts`); if a scrape comes back with a field empty or
wrong, that selector list is the place to fix it.

## Ad Library (Meta ads) search

A separate lead-discovery path from the Amazon->Brand one above: `/ad-library`
searches the Meta Ad Library (via [SearchAPI.io](https://www.searchapi.io/),
`lib/searchApi.ts`) for a product/keyword and saves every Page running at
least N currently-active ads for it (`active_status=active`) — a brand that's
actively spending on ads is a live, responsive lead in a way a dormant Amazon
listing isn't. Results land in the `MetaAdBrand` table, keyed by
(`pageId`, `searchKeyword`) — re-running the same keyword search updates the
ad counts rather than duplicating rows, since they're a live snapshot, not
history. A single search scans up to 5 pages of Ad Library results
(`MAX_PAGES` in `lib/metaAds/runMetaAdsSearchJob.ts`) to bound cost/time on
broad keywords; the job log says explicitly if that cap was hit.

Verified against live output with a real `SEARCHAPI_API_KEY`.

### Contact enrichment for Ad Library brands

Same idea as Amazon->Brand enrichment, applied to `MetaAdBrand` rows: from
`/ad-library`, "Enrich pending brands" (bulk) or the per-row retry icon starts
a `META_ADS_ENRICHMENT` job that looks up each Page's website, email, and
phone. It reuses the exact same pipeline as Brand enrichment —
`lib/enrichment/findContactInfo.ts` (domain guessing, Google-search fallback,
contact-page crawl) — keyed off the Page name instead of an Amazon byline
brand name, and writes to the same `websiteUrl`/`email`/`phone`/
`enrichmentStatus` shape. The bulk button and the `needs-enrichment` job mode
both skip brands already `FOUND` or `NOT_FOUND` for the same reason as Brand
enrichment: don't keep re-spending scrape.do credits on a lookup that already
succeeded or already failed once.

## Plugging in Hunter.io later

`lib/enrichment/emailProvider.ts` defines an `EmailProvider` interface and an
unimplemented `hunterProvider`. Nothing calls it yet — the regex/`mailto:`
extractor in `lib/enrichment/extractContact.ts` is the only active email
source. To wire it up:

1. Set `HUNTER_API_KEY` in `.env.local`.
2. Implement `hunterProvider.lookup()` to call Hunter's Domain Search / Email
   Finder API and map the response into `EmailLookupResult`.
3. In `lib/enrichment/runEnrichmentJob.ts`, call it as a fallback wherever
   `extractEmail()` comes back `null`.

## Project structure

- `prisma/schema.prisma` — `ScrapeJob`, `Product`, `Brand`, `MetaAdBrand` models
- `lib/scrapeDo.ts` — the single scrape.do client wrapper (both Amazon and
  Google fetches go through this)
- `lib/searchApi.ts` — the single SearchAPI.io client wrapper (Meta Ad Library)
- `lib/amazon/` — search-results/product-page parsing + the search job runner
- `lib/enrichment/` — Google search parsing, website-candidate scoring,
  contact extraction, and the enrichment job runners for both `Brand` and
  `MetaAdBrand` (shared discovery logic lives in `findContactInfo.ts`)
- `lib/metaAds/` — the Ad Library search job runner and the Ad Library
  contact-enrichment job runner
- `lib/jobs.ts` — `ScrapeJob` lifecycle helpers (status, progress, logs)
- `lib/scoring.ts` — the `lowSaleScore` formula
- `app/api/scrape/amazon`, `app/api/scrape/enrich`, `app/api/scrape/meta-ads`,
  `app/api/scrape/meta-ads/enrich` — start a job
- `app/api/jobs/[id]` — polled by the job detail page while it runs
- `app/api/export/{products,brands,meta-ads}` — CSV export of the current filtered view

## Deploying

The background-job design (`after()` in the API routes, running the actual
scrape/enrichment loop past the point the HTTP response is sent) needs a
persistent Node.js process — a self-hosted `next start` or a Docker container.
On a serverless platform with a short function-execution limit, a scrape job
spanning many pages/products could be killed mid-run.
