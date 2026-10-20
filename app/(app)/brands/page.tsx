import Link from "next/link";
import { Building2, Check, ExternalLink, Globe, Mail, Phone, X } from "lucide-react";
import { prisma } from "@/lib/db";
import { BrandEnrichmentStatus, type Prisma } from "@/lib/generated/prisma/client";
import { requirePageUser } from "@/lib/auth/currentUser";
import { isAdmin, ownedBy } from "@/lib/auth/access";
import { brandExportWhere, brandNameWhere, primaryProductArgs } from "@/lib/brands";
import { searchesForBrands } from "@/lib/brandSearches";
import { jobLabel } from "@/lib/jobSummary";
import { BrandsFilterBar } from "@/components/BrandsFilterBar";
import { EnrichAllButton } from "@/components/EnrichAllButton";
import { ExportBrandsButton } from "@/components/ExportBrandsButton";
import { SearchChips } from "@/components/SearchChips";
import { StatusBadge } from "@/components/StatusBadge";
import { Pagination } from "@/components/Pagination";
import { avatarColorFor } from "@/lib/avatarColor";
import type { BrandSummary, JobOption } from "@/lib/types";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 25;
const MAX_SEARCH_CHIPS = 8;
const MAX_SEARCH_OPTIONS = 30;
const MAX_SEARCH_PILLS = 2;
const VALID_STATUSES = new Set<string>(Object.values(BrandEnrichmentStatus));

export default async function BrandsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = await requirePageUser();
  const scope = ownedBy(user);
  const admin = isAdmin(user);
  const params = await searchParams;
  const get = (key: string) => {
    const value = params[key];
    return typeof value === "string" ? value : "";
  };

  const q = get("q");
  const statusRaw = get("status");
  const status = VALID_STATUSES.has(statusRaw) ? (statusRaw as BrandEnrichmentStatus) : undefined;
  const exportedRaw = get("exported");
  const exported = exportedRaw === "no" || exportedRaw === "yes" ? exportedRaw : "";
  const jobId = get("jobId");
  const page = Math.max(1, parseInt(get("page") || "1", 10) || 1);

  // Only brands found in this search (scrape job).
  const jobFilter: Prisma.BrandWhereInput = jobId ? { products: { some: { scrapeJobId: jobId } } } : {};

  const where: Prisma.BrandWhereInput = {
    ...scope,
    ...jobFilter,
    ...brandNameWhere(q),
    ...(status ? { enrichmentStatus: status } : {}),
    ...(exported === "no" ? { exportedAt: null } : {}),
    ...(exported === "yes" ? { exportedAt: { not: null } } : {}),
  };

  const [total, brands, needsEnrichmentCount, exportNewCount, exportAllCount, searchJobs, activeJob] =
    await Promise.all([
      prisma.brand.count({ where }),
      prisma.brand.findMany({
        where,
        orderBy: { updatedAt: "desc" },
        skip: (page - 1) * PAGE_SIZE,
        take: PAGE_SIZE,
        include: {
          _count: { select: { products: true } },
          products: primaryProductArgs,
          user: { select: { email: true } },
        },
      }),
      // Not narrowed by the filters — the button enriches every pending brand
      // you can see, whatever the current search/status filter is showing.
      // Matches the enrich route's "needs-enrichment" query: excludes FOUND,
      // NOT_FOUND, and PARTIAL (each already checked once — don't keep
      // re-spending credits automatically on brands unlikely to resolve
      // differently).
      prisma.brand.count({
        where: { ...scope, enrichmentStatus: { notIn: ["FOUND", "NOT_FOUND", "PARTIAL"] } },
      }),
      // What Export CSV would contain for the current filters: Found and
      // Partial brands only, without and with the already-exported ones.
      prisma.brand.count({
        where: { ...scope, ...jobFilter, ...brandExportWhere({ q, status, includeExported: false }) },
      }),
      prisma.brand.count({
        where: { ...scope, ...jobFilter, ...brandExportWhere({ q, status, includeExported: true }) },
      }),
      // The searches brands came from, newest first.
      prisma.scrapeJob.findMany({
        where: { ...scope, type: "AMAZON_SEARCH", products: { some: { brandId: { not: null } } } },
        orderBy: { createdAt: "desc" },
        take: MAX_SEARCH_OPTIONS,
        select: { id: true, type: true, input: true, createdAt: true },
      }),
      jobId
        ? prisma.scrapeJob.findFirst({
            where: { id: jobId, ...scope },
            select: { id: true, type: true, input: true, createdAt: true },
          })
        : null,
    ]);

  // Brands per search (a brand with several products in one search counts once).
  const brandPairs = await prisma.product.groupBy({
    by: ["scrapeJobId", "brandId"],
    where: { ...scope, brandId: { not: null }, scrapeJobId: { in: searchJobs.map((job) => job.id) } },
  });
  const brandsPerJob = new Map<string, number>();
  for (const pair of brandPairs) {
    brandsPerJob.set(pair.scrapeJobId, (brandsPerJob.get(pair.scrapeJobId) ?? 0) + 1);
  }
  const jobOptions: JobOption[] = searchJobs.map((job) => ({
    id: job.id,
    label: jobLabel(job),
    count: brandsPerJob.get(job.id) ?? 0,
  }));

  const searchesByBrand = await searchesForBrands(brands.map((brand) => brand.id));

  const rows: BrandSummary[] = brands.map((brand) => ({
    id: brand.id,
    name: brand.name,
    displayName: brand.displayName,
    websiteUrl: brand.websiteUrl,
    email: brand.email,
    phone: brand.phone,
    productUrl: brand.products[0]?.url ?? null,
    enrichmentStatus: brand.enrichmentStatus,
    productCount: brand._count.products,
    searches: searchesByBrand.get(brand.id) ?? [],
    exportedAt: brand.exportedAt?.toISOString() ?? null,
    updatedAt: brand.updatedAt.toISOString(),
    ...(admin ? { ownerEmail: brand.user?.email ?? null } : {}),
  }));

  const filterParams = new URLSearchParams();
  if (q) filterParams.set("q", q);
  if (status) filterParams.set("status", status);
  if (exported) filterParams.set("exported", exported);

  const pageParams = new URLSearchParams(filterParams);
  if (jobId) pageParams.set("jobId", jobId);

  function buildPageHref(nextPage: number) {
    const p = new URLSearchParams(pageParams);
    if (nextPage > 1) p.set("page", String(nextPage));
    return `/brands?${p.toString()}`;
  }

  function buildSearchHref(nextJobId: string) {
    const p = new URLSearchParams(filterParams);
    if (nextJobId) p.set("jobId", nextJobId);
    const query = p.toString();
    return query ? `/brands?${query}` : "/brands";
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Brands</h1>
          <p className="mt-1 text-sm text-slate-500">{total} brand(s) discovered</p>
        </div>
        <div className="flex items-center gap-3">
          <ExportBrandsButton
            q={q}
            status={status ?? ""}
            jobId={jobId}
            newCount={exportNewCount}
            allCount={exportAllCount}
          />
          <EnrichAllButton count={needsEnrichmentCount} endpoint="/api/scrape/enrich" />
        </div>
      </div>

      <SearchChips
        jobs={jobOptions.slice(0, MAX_SEARCH_CHIPS)}
        activeJobId={jobId}
        buildHref={buildSearchHref}
      />

      {activeJob && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center gap-2 rounded-lg bg-indigo-50 py-1.5 pl-3 pr-1.5 text-sm text-indigo-700">
            Found via: <Link href={`/jobs/${activeJob.id}`} className="font-medium hover:underline">{jobLabel(activeJob)}</Link>
            <Link href={buildSearchHref("")} className="rounded p-1 hover:bg-indigo-100" aria-label="Clear search filter">
              <X className="h-3.5 w-3.5" />
            </Link>
          </span>
        </div>
      )}

      <BrandsFilterBar jobOptions={jobOptions} />

      {total === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-slate-200 bg-white py-16 text-center">
          <Building2 className="h-8 w-8 text-slate-300" />
          <p className="text-sm text-slate-500">
            {q || status || exported || jobId
              ? "No brands match these filters."
              : "No brands yet — start a scrape to find some."}
          </p>
        </div>
      ) : (
        <>
          <div className="overflow-x-auto rounded-2xl border border-slate-200/70 bg-white shadow-sm shadow-slate-200/50">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="text-left text-xs font-medium text-slate-400">
                  <th className="px-6 py-3 font-medium">Name</th>
                  <th className="px-6 py-3 font-medium">Website</th>
                  <th className="px-6 py-3 font-medium">Email</th>
                  <th className="px-6 py-3 font-medium">Phone</th>
                  <th className="px-6 py-3 font-medium">Product URL</th>
                  <th className="px-6 py-3 font-medium">Found via</th>
                  <th className="px-6 py-3 font-medium">Status</th>
                  <th className="px-6 py-3 font-medium">Products</th>
                  <th className="px-6 py-3 font-medium">Updated</th>
                  {admin && <th className="px-6 py-3 font-medium">Owner</th>}
                </tr>
              </thead>
              <tbody>
                {rows.map((brand) => (
                  <tr key={brand.id} className="border-t border-slate-100 hover:bg-slate-50/70">
                    <td className="px-6 py-3.5">
                      <Link href={`/brands/${brand.id}`} className="flex items-center gap-2.5">
                        <span
                          className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${avatarColorFor(brand.displayName)}`}
                        >
                          {brand.displayName.charAt(0).toUpperCase()}
                        </span>
                        <span className="font-medium text-slate-800 hover:text-indigo-600">
                          {brand.displayName}
                        </span>
                      </Link>
                    </td>
                    <td className="px-6 py-3.5">
                      {brand.websiteUrl ? (
                        <a
                          href={brand.websiteUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1.5 font-mono text-xs text-indigo-600 hover:underline"
                        >
                          <Globe className="h-3.5 w-3.5 shrink-0" />
                          {brand.websiteUrl.replace(/^https?:\/\//, "")}
                        </a>
                      ) : (
                        <span className="text-slate-300">—</span>
                      )}
                    </td>
                    <td className="px-6 py-3.5">
                      {brand.email ? (
                        <span className="inline-flex items-center gap-1.5 font-mono text-xs text-slate-600">
                          <Mail className="h-3.5 w-3.5 shrink-0 text-slate-400" />
                          {brand.email}
                        </span>
                      ) : (
                        <span className="text-slate-300">—</span>
                      )}
                    </td>
                    <td className="px-6 py-3.5">
                      {brand.phone ? (
                        <span className="inline-flex items-center gap-1.5 font-mono text-xs text-slate-600">
                          <Phone className="h-3.5 w-3.5 shrink-0 text-slate-400" />
                          {brand.phone}
                        </span>
                      ) : (
                        <span className="text-slate-300">—</span>
                      )}
                    </td>
                    <td className="px-6 py-3.5">
                      {brand.productUrl ? (
                        <a
                          href={brand.productUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          title={brand.productUrl}
                          className="inline-flex max-w-[200px] items-center gap-1.5 font-mono text-xs text-indigo-600 hover:underline"
                        >
                          <ExternalLink className="h-3.5 w-3.5 shrink-0" />
                          <span className="truncate">
                            {brand.productUrl.replace(/^https?:\/\/(www\.)?/, "").replace(/[?#].*$/, "")}
                          </span>
                        </a>
                      ) : (
                        <span className="text-slate-300">—</span>
                      )}
                    </td>
                    <td className="px-6 py-3.5">
                      {brand.searches.length === 0 ? (
                        <span className="text-slate-300">—</span>
                      ) : (
                        <div className="flex max-w-[240px] flex-wrap gap-1">
                          {brand.searches.slice(0, MAX_SEARCH_PILLS).map((search) => (
                            <Link
                              key={search.jobId}
                              href={buildSearchHref(search.jobId)}
                              title={`Show the brands found in ${search.label}`}
                              className={`max-w-[220px] truncate rounded-full px-2 py-0.5 text-[11px] font-medium ${
                                search.jobId === jobId
                                  ? "bg-indigo-600 text-white"
                                  : "bg-indigo-50 text-indigo-700 hover:bg-indigo-100"
                              }`}
                            >
                              {search.label}
                            </Link>
                          ))}
                          {brand.searches.length > MAX_SEARCH_PILLS && (
                            <span
                              title={brand.searches
                                .slice(MAX_SEARCH_PILLS)
                                .map((search) => search.label)
                                .join("\n")}
                              className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-500"
                            >
                              +{brand.searches.length - MAX_SEARCH_PILLS} more
                            </span>
                          )}
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-3.5">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <StatusBadge status={brand.enrichmentStatus} />
                        {brand.exportedAt && (
                          <span
                            title={`Exported ${new Date(brand.exportedAt).toLocaleString()}`}
                            className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-1 text-[11px] font-medium text-slate-500"
                          >
                            <Check className="h-3 w-3" />
                            Exported
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-3.5 tabular-nums text-slate-600">{brand.productCount}</td>
                    <td className="px-6 py-3.5 text-slate-500">
                      {new Date(brand.updatedAt).toLocaleDateString()}
                    </td>
                    {admin && (
                      <td className="px-6 py-3.5 text-slate-500">{brand.ownerEmail ?? "unassigned"}</td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex items-center justify-between">
            <p className="text-xs text-slate-500">{total} brand(s)</p>
            <Pagination page={page} hasNext={page * PAGE_SIZE < total} buildHref={buildPageHref} />
          </div>
        </>
      )}
    </div>
  );
}
