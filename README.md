# Amazon Lead Scraper

Finds low-performing Amazon products, identifies their brand, discovers the
brand's company website via a web search, and extracts a contact email/phone —
building a lead list for outreach.

## Stack

- Next.js (App Router) + TypeScript
- Prisma ORM + PostgreSQL — works with any Postgres-compatible provider (local
  Postgres, Supabase, Neon) via `DATABASE_URL`
- Tailwind CSS
- All outbound fetching (Amazon pages, search-engine pages, brand websites)
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

## Parsing is checked against live output — but these sites change

`lib/amazon/selectors.ts` (Amazon), `lib/enrichment/bingSearch.ts` and
`lib/enrichment/googleSearch.ts` (search results) were all verified against
real scrape.do responses. They still break when a site changes its markup, so
if a field comes back empty or wrong, those are the files to fix (Amazon lists
fallback selectors tried in order). One quirk worth knowing: Google often
serves result links as opaque `/goto?url=<token>` redirects, so the
destination is read from the URL printed under each title (`<cite>`).

## Amazon marketplaces (US / UK)

"New Scrape" starts with a **Marketplace** choice: United States (`amazon.com`)
or United Kingdom (`amazon.co.uk`). It decides the search URL and the product
URLs that get saved, and for the UK scrape.do fetches with `geoCode=gb` so pages
look as they do to a UK shopper (prices in £). A pasted category URL must belong
to the chosen marketplace (the form switches the choice for you when you paste
one). Products remember their marketplace (`Product.marketplace`): the same ASIN
on both sites is two separate rows, and the Products page can filter by it.
Brands are shared across marketplaces.

To add another site (say `amazon.de`): add it to `lib/amazon/marketplaces.ts`,
add the value to the `AmazonMarketplace` enum in `prisma/schema.prisma` with a
migration, and check the selectors in `lib/amazon/selectors.ts` against a saved
page of that site (they were verified on amazon.com and amazon.co.uk).

## Finding a brand's website

`lib/enrichment/findContactInfo.ts`, in order, stopping at the first success:

1. **Domain guess** — fetch `<brandname>.com` (1 credit). Accepted only if the
   page isn't a parked/for-sale domain and mentions the brand name in its own
   text (`lib/enrichment/siteCheck.ts`).
2. **Bing search** — 1 credit. A result is only picked if its domain contains
   at least half of the brand-name words (`lib/enrichment/pickWebsite.ts`), so
   an unrelated top result is never saved as the brand's site.
3. **Google search** — 10 credits, rendered. Only used when Bing's page can't be
   read at all (blocked/changed), not when Bing simply finds nothing.

Placeholder brands ("Generic", "Unbranded"...) are skipped without spending
credits. If scrape.do can't be reached mid-lookup the brand stays
`NOT_STARTED` (not `NOT_FOUND`), so the next "Enrich pending brands" retries it.

## Ad Library (Meta ads) search

A separate lead-discovery path from the Amazon->Brand one above: `/ad-library`
searches the Meta Ad Library (via [SearchAPI.io](https://www.searchapi.io/),
`lib/searchApi.ts`) for a product/keyword and saves every Page running at
least N currently-active ads for it (`active_status=active`) — a brand that's
actively spending on ads is a live, responsive lead in a way a dormant Amazon
listing isn't. Results land in the `MetaAdBrand` table, keyed by
(owner, `pageId`, `searchKeyword`) — re-running the same keyword search updates
the ad counts rather than duplicating rows, since they're a live snapshot, not
history. A single search scans up to 5 pages of Ad Library results
(`MAX_PAGES` in `lib/metaAds/runMetaAdsSearchJob.ts`) to bound cost/time on
broad keywords; the job log says explicitly if that cap was hit.

Verified against live output with a real `SEARCHAPI_API_KEY`.

### Contact enrichment for Ad Library brands

Same idea as Amazon->Brand enrichment, applied to `MetaAdBrand` rows: from
`/ad-library`, "Enrich pending brands" (bulk) or the per-row retry icon starts
a `META_ADS_ENRICHMENT` job that looks up each Page's website, email, and
phone. It reuses the exact same pipeline as Brand enrichment —
`lib/enrichment/findContactInfo.ts` (domain guessing, Bing search with a Google
fallback, contact-page crawl) — keyed off the Page name instead of an Amazon byline
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
- `lib/scrapeDo.ts` — the single scrape.do client wrapper (Amazon, search and
  brand-site fetches all go through this)
- `lib/searchApi.ts` — the single SearchAPI.io client wrapper (Meta Ad Library)
- `lib/amazon/` — search-results/product-page parsing + the search job runner
- `lib/enrichment/` — Bing/Google search parsing, website-candidate scoring,
  contact extraction, and the enrichment job runners for both `Brand` and
  `MetaAdBrand` (shared discovery logic lives in `findContactInfo.ts`)
- `lib/metaAds/` — the Ad Library search job runner and the Ad Library
  contact-enrichment job runner
- `lib/jobs.ts` — `ScrapeJob` lifecycle helpers (status, progress, logs, stopping)
- `lib/auth/access.ts` — `ownedBy(user)`: who can see which rows (see "Who sees what")
- `lib/brandStatus.ts` — the statuses a person can set by hand, and how a status follows the contact details
- `lib/brandSearches.ts` — which searches each brand was found in (the "Found via" column)
- `lib/scoring.ts` — the `lowSaleScore` formula
- `app/api/scrape/amazon`, `app/api/scrape/enrich`, `app/api/scrape/meta-ads`,
  `app/api/scrape/meta-ads/enrich` — start a job
- `app/api/jobs/[id]` — polled by the job detail page while it runs;
  `app/api/jobs/[id]/cancel` (POST) stops it
- `app/api/export/{products,meta-ads}` — CSV export of the current filtered view
- `app/api/export/brands` (POST) — CSV of Found/Partial brands only (Not found is never
  exported). Skips brands exported before unless `includeExported` is set, and marks what
  it exports (`Brand.exportedAt`)

## Login

Every page and API route needs a signed-in user: `proxy.ts` checks a signed
session cookie on every request, and `lib/auth/currentUser.ts` also confirms the
account still exists. There is no sign-up form — an admin creates accounts with
`scripts/users.mjs`:

```
npm run user -- create alice@company.com      # generates a password, shown once
npm run user -- create bob@company.com 'ChosenPass1'
npm run user -- create carol@company.com --admin   # an admin sees everyone's data
npm run user -- role alice@company.com admin       # or: member
npm run user -- password alice@company.com    # reset (generates a new one)
npm run user -- delete alice@company.com      # locked out within ~30 seconds
npm run user -- list                          # shows each account's role
npm run user -- secret                        # a new AUTH_SECRET for .env
```

`AUTH_SECRET` (32+ random characters in `.env`) signs the session cookies;
sessions last 7 days. Five wrong passwords lock that email out for 15 minutes.
Behind HTTPS (a reverse proxy), make sure it forwards `X-Forwarded-Proto` so the
cookie is marked `Secure` (Caddy and nginx's usual setups do).

## Who sees what

Every scrape job, product, brand and Ad Library row belongs to the person who
started it (`userId`). Two people who scrape the same keyword each get their own
rows — their own brands, their own enrichment results, their own manual edits
and "Exported" flags. Nobody can read, edit, stop or export someone else's rows:
the pages and API routes answer 404, exactly as for something that doesn't
exist.

- **Admin** (`User.role = ADMIN`, stored in the database so every copy of the
  app agrees) sees everything, with an "Owner" column/tag on each list, and the
  dashboard gets a **Team activity** table (`lib/teamStats.ts`): per person, the
  searches run, products and brands found, how many brands are Found / Partial /
  Not found / Pending, how many have an email or were exported, their Ad Library
  results, and when they were last active. The
  migration made `rehmanmirza458@gmail.com` the admin and gave it all the data
  that existed before accounts owned anything. Change roles with
  `npm run user -- role <email> <admin|member>`; the last admin can't be
  demoted or deleted.
- Deleting an account keeps its data, now unowned: only an admin can see it.
- An admin's "Enrich pending brands" works on everything the admin can see.
  An admin's CSV export includes everyone's brands but only marks the admin's
  own as exported, so it never changes an employee's "Skip already exported" list.
- **For developers:** spread `ownedBy(user)` (`lib/auth/access.ts`) into the
  `where` of every query on those four tables, and create rows with the
  current user's id. Forgetting it shows one person's leads to another.

## Stopping a job

A job that is pending or running has a **Stop** button (job page and Jobs list).
The runner checks between items, so it finishes the one it is on, keeps
everything found so far, and ends as **Stopped** (`CANCELLED`) — it can never
flip back to Completed. Brands an enrichment hadn't reached keep their status.
Stopping also clears a job left "running" by a closed window or a restart. You
can only stop your own jobs (an admin can stop anyone's).

## Brands: which search they came from, and manual lookups

- Each brand lists the searches it was found in (**Found via**, in the table,
  on the brand page and in the Brands CSV), and the Brands page can be narrowed
  to one search with the chips or the dropdown (the export follows that filter).
  A product belongs to the *latest* search that saw it, so a later, overlapping
  search takes over the products it has in common with an earlier one.
- To look a brand up yourself, open it (**Search on Google** is there), enter
  the website, email and phone, and save. The status follows what you entered —
  website + email = Found, one of them = Partial — or pick one yourself in the
  **Status** box (for example *Not found* after searching). Only Found and
  Partial brands go into the Brands export, so this is how a hand-researched
  brand becomes exportable. Each save adds a line to the brand's notes.

## Portable zip for the team (Windows)

`npm run package` builds `dist\lead-scraper-portable.zip`: the production build,
a copy of the installed `node.exe`, a filtered copy of `.env`, and `start.bat`.
A teammate unzips it and double-clicks `start.bat` — no Node, Docker or editor
to install — then signs in with an account made above. The app listens on
`127.0.0.1:3210` only, and every copy shares the same Supabase database (each
person only sees their own data in it — see "Who sees what").

- The zip contains the database password and API keys (`.env`): share it inside
  the team only, and rotate them when someone leaves. Since every PC holds
  them, the login keeps casual users out but is not a hard boundary against a
  technical teammate — that needs the app on a server instead.
- Scrapes run inside each PC's `start.bat` window, so that PC must stay on, and
  everyone shares one scrape.do credit pool.
- After a schema change run `npx prisma migrate deploy` yourself, then build and
  share a new zip. Copies built before the change stop working for scraping as
  soon as the database changes (this applies to the per-user data migration), so
  hand everyone the new zip at the same time.

## Deploying

The background-job design (`after()` in the API routes, running the actual
scrape/enrichment loop past the point the HTTP response is sent) needs a
persistent Node.js process — a self-hosted `next start` or a Docker container.
On a serverless platform with a short function-execution limit, a scrape job
spanning many pages/products could be killed mid-run.

### Vercel

It builds and runs, with two things to know:

- `next.config.ts` turns `output: "standalone"` off when `VERCEL` is set (Vercel
  sets it during its builds). Left on, the build ends with
  `ENOENT ... .next/next-server.js.nft.json`. Docker and the portable zip still
  use standalone.
- A job is cut off when the function reaches its time limit (`maxDuration`,
  plan-dependent), leaving it "running" — **Stop** it from the Jobs page. Long
  scrapes belong on the Docker/VPS setup or the portable zip.

Set `DATABASE_URL` (the Supabase **transaction pooler**, port 6543), `AUTH_SECRET`,
`SCRAPE_DO_API_KEY` and `SEARCHAPI_API_KEY` in the Vercel project's environment
variables, and run `npx prisma migrate deploy` against Supabase before the first
deploy of a version with schema changes.

### Docker on a VPS, with Supabase as the database

1. Create a Supabase project and put two of its URIs in `.env` (Connect), with
   your database password filled in:
   - `DATABASE_URL` = the **Transaction pooler** (port 6543) — what the app
     uses. It shares the project's small connection limit between many copies
     of the app (each team member's PC, the VPS...).
   - `DIRECT_URL` = the **Session pooler** (port 5432) — used only for
     migrations, which need a real session.

   Don't add `sslmode=` — `lib/db.ts` switches SSL on for Supabase hosts itself
   (Supabase's certificate isn't in Node's trust store, so the chain isn't
   verified).
2. Create the tables once with `npx prisma migrate deploy` (the Docker
   entrypoint also runs it on every start).
3. On the VPS, put the same `.env` next to the code and run
   `docker compose up -d --build`. Only the app starts; it uses Supabase.

Notes:

- `docker compose --profile local-db up -d --build` starts a bundled Postgres
  instead (set `DATABASE_URL=postgresql://postgres:postgres@db:5432/mydb`).
- A migration turns on row level security for every table so Supabase's public
  REST API can't read the leads. The app connects directly as the tables' owner
  and is unaffected. Do the same for any table you add later.
- Free Supabase projects pause after about a week without activity.
