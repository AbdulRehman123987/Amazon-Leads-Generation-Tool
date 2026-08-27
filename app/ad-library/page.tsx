import Link from "next/link";
import { Download, Megaphone, ThumbsUp, ExternalLink, Plus, Mail, Phone, Globe } from "lucide-react";
import { prisma } from "@/lib/db";
import type { Prisma } from "@/lib/generated/prisma/client";
import { MetaAdsFilterBar } from "@/components/MetaAdsFilterBar";
import { Pagination } from "@/components/Pagination";
import { Button } from "@/components/Button";
import { StatusBadge } from "@/components/StatusBadge";
import { EnrichAllButton } from "@/components/EnrichAllButton";
import { MetaAdRowEnrichButton } from "@/components/MetaAdRowEnrichButton";
import { avatarColorFor } from "@/lib/avatarColor";
import type { MetaAdBrandRow } from "@/lib/types";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 25;
const MAX_KEYWORD_CHIPS = 8;

export default async function AdLibraryPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const get = (key: string) => {
    const value = params[key];
    return typeof value === "string" ? value : "";
  };

  const q = get("q");
  const keyword = get("keyword");
  const minActiveAdsRaw = get("minActiveAds");
  const minActiveAds = minActiveAdsRaw ? parseInt(minActiveAdsRaw, 10) : undefined;
  const page = Math.max(1, parseInt(get("page") || "1", 10) || 1);
  const sortParam = get("sort") || "-activeAdCount";

  const where: Prisma.MetaAdBrandWhereInput = {
    ...(q ? { pageName: { contains: q, mode: "insensitive" } } : {}),
    ...(keyword ? { searchKeyword: keyword } : {}),
    ...(minActiveAds != null && Number.isFinite(minActiveAds)
      ? { activeAdCount: { gte: minActiveAds } }
      : {}),
  };

  const direction: Prisma.SortOrder = sortParam.startsWith("-") ? "desc" : "asc";
  const sortField = sortParam.replace(/^-/, "");
  const orderBy: Prisma.MetaAdBrandOrderByWithRelationInput =
    sortField === "pageLikeCount" ? { pageLikeCount: direction } : { activeAdCount: direction };

  const [total, brands, keywordGroups, needsEnrichmentCount] = await Promise.all([
    prisma.metaAdBrand.count({ where }),
    prisma.metaAdBrand.findMany({
      where,
      orderBy,
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
    prisma.metaAdBrand.groupBy({
      by: ["searchKeyword"],
      _count: true,
      orderBy: { _count: { searchKeyword: "desc" } },
      take: MAX_KEYWORD_CHIPS,
    }),
    // Unfiltered, same rule as Brand: skip a confirmed FOUND or an already-
    // tried NOT_FOUND so the bulk button doesn't keep re-spending credits.
    prisma.metaAdBrand.count({ where: { enrichmentStatus: { notIn: ["FOUND", "NOT_FOUND"] } } }),
  ]);

  const rows: MetaAdBrandRow[] = brands.map((b) => ({
    id: b.id,
    pageId: b.pageId,
    pageName: b.pageName,
    pageProfileUri: b.pageProfileUri,
    pageProfilePicture: b.pageProfilePicture,
    pageLikeCount: b.pageLikeCount,
    pageCategory: b.pageCategory,
    searchKeyword: b.searchKeyword,
    activeAdCount: b.activeAdCount,
    sampleAdSnippet: b.sampleAdSnippet,
    websiteUrl: b.websiteUrl,
    email: b.email,
    phone: b.phone,
    enrichmentStatus: b.enrichmentStatus,
    updatedAt: b.updatedAt.toISOString(),
  }));

  const baseParams = new URLSearchParams();
  if (q) baseParams.set("q", q);
  if (minActiveAdsRaw) baseParams.set("minActiveAds", minActiveAdsRaw);

  const exportParams = new URLSearchParams(baseParams);
  if (keyword) exportParams.set("keyword", keyword);

  function buildPageHref(nextPage: number) {
    const p = new URLSearchParams(exportParams);
    p.set("sort", sortParam);
    if (nextPage > 1) p.set("page", String(nextPage));
    return `/ad-library?${p.toString()}`;
  }

  function buildKeywordChipHref(nextKeyword: string) {
    const p = new URLSearchParams(baseParams);
    if (nextKeyword) p.set("keyword", nextKeyword);
    p.set("sort", sortParam);
    return `/ad-library?${p.toString()}`;
  }

  function sortHref(field: "activeAdCount" | "pageLikeCount") {
    const isActive = sortField === field;
    const nextDirection = isActive && direction === "desc" ? "asc" : "desc";
    const value = nextDirection === "desc" ? `-${field}` : field;
    const p = new URLSearchParams(exportParams);
    p.set("sort", value);
    return `/ad-library?${p.toString()}`;
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Ad Library</h1>
          <p className="mt-1 text-sm text-slate-500">
            {total} brand(s) actively running Meta ads, found via product search
          </p>
        </div>
        <div className="flex items-center gap-3">
          <a
            href={`/api/export/meta-ads?${exportParams.toString()}`}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-sm font-medium text-slate-700 shadow-sm transition-colors hover:border-slate-300 hover:bg-slate-50"
          >
            <Download className="h-4 w-4" />
            Export CSV
          </a>
          <Link href="/ad-library/new">
            <Button variant="primary">
              <Plus className="h-4 w-4" />
              New Search
            </Button>
          </Link>
        </div>
      </div>

      {keywordGroups.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-medium text-slate-400">Searches:</span>
          <Link
            href={buildKeywordChipHref("")}
            className={`rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
              !keyword
                ? "bg-indigo-600 text-white"
                : "border border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
            }`}
          >
            All
          </Link>
          {keywordGroups.map((g) => (
            <Link
              key={g.searchKeyword}
              href={buildKeywordChipHref(g.searchKeyword)}
              className={`rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
                keyword === g.searchKeyword
                  ? "bg-indigo-600 text-white"
                  : "border border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
              }`}
            >
              {g.searchKeyword} · {g._count}
            </Link>
          ))}
        </div>
      )}

      <div className="flex flex-wrap items-end justify-between gap-3">
        <MetaAdsFilterBar keywordOptions={keywordGroups.map((g) => g.searchKeyword)} />
        <EnrichAllButton count={needsEnrichmentCount} endpoint="/api/scrape/meta-ads/enrich" />
      </div>

      {total === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-slate-200 bg-white py-16 text-center">
          <Megaphone className="h-8 w-8 text-slate-300" />
          <p className="text-sm text-slate-500">
            {q || keyword || minActiveAds
              ? "No advertisers match these filters."
              : "No Ad Library searches yet — search for a product to find who's advertising it."}
          </p>
        </div>
      ) : (
        <>
          <div className="overflow-x-auto rounded-2xl border border-slate-200/70 bg-white shadow-sm shadow-slate-200/50">
            <table className="w-full min-w-[1200px] border-collapse text-sm">
              <thead>
                <tr className="text-left text-xs font-medium text-slate-400">
                  <th className="px-6 py-3 font-medium">Page</th>
                  <th className="px-6 py-3 font-medium">
                    <Link href={sortHref("pageLikeCount")} className="hover:text-slate-600">
                      Likes {sortField === "pageLikeCount" ? (direction === "desc" ? "↓" : "↑") : ""}
                    </Link>
                  </th>
                  <th className="px-6 py-3 font-medium">
                    <Link href={sortHref("activeAdCount")} className="hover:text-slate-600">
                      Active ads {sortField === "activeAdCount" ? (direction === "desc" ? "↓" : "↑") : ""}
                    </Link>
                  </th>
                  <th className="px-6 py-3 font-medium">Website</th>
                  <th className="px-6 py-3 font-medium">Email</th>
                  <th className="px-6 py-3 font-medium">Phone</th>
                  <th className="px-6 py-3 font-medium">Status</th>
                  <th className="px-6 py-3 font-medium">Updated</th>
                  <th className="px-6 py-3 font-medium"></th>
                </tr>
              </thead>
              <tbody>
                {rows.map((brand) => (
                  <tr key={brand.id} className="border-t border-slate-100 hover:bg-slate-50/70">
                    <td className="px-6 py-3.5">
                      <div className="flex items-center gap-2.5">
                        {brand.pageProfilePicture ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={brand.pageProfilePicture}
                            alt={brand.pageName}
                            className="h-7 w-7 shrink-0 rounded-full object-cover"
                          />
                        ) : (
                          <span
                            className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${avatarColorFor(brand.pageName)}`}
                          >
                            {brand.pageName.charAt(0).toUpperCase()}
                          </span>
                        )}
                        <div className="flex flex-col">
                          {brand.pageProfileUri ? (
                            <a
                              href={brand.pageProfileUri}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 font-medium text-slate-800 hover:text-indigo-600"
                            >
                              {brand.pageName}
                              <ExternalLink className="h-3 w-3 text-slate-300" />
                            </a>
                          ) : (
                            <span className="font-medium text-slate-800">{brand.pageName}</span>
                          )}
                          <span className="rounded-full bg-slate-100 px-1.5 py-0.5 text-[11px] font-medium text-slate-500 w-fit">
                            {brand.searchKeyword}
                          </span>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-3.5 tabular-nums text-slate-600">
                      {brand.pageLikeCount != null ? (
                        <span className="inline-flex items-center gap-1">
                          <ThumbsUp className="h-3.5 w-3.5 text-slate-300" />
                          {brand.pageLikeCount.toLocaleString()}
                        </span>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="px-6 py-3.5">
                      <span className="inline-flex items-center rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold tabular-nums text-emerald-700">
                        {brand.activeAdCount}
                      </span>
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
                      <StatusBadge status={brand.enrichmentStatus} />
                    </td>
                    <td className="px-6 py-3.5 text-slate-500">
                      {new Date(brand.updatedAt).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-3.5 text-right">
                      <MetaAdRowEnrichButton id={brand.id} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex items-center justify-between">
            <p className="text-xs text-slate-500">{total} advertiser(s)</p>
            <Pagination page={page} hasNext={page * PAGE_SIZE < total} buildHref={buildPageHref} />
          </div>
        </>
      )}
    </div>
  );
}
