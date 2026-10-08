import Link from "next/link";
import { Building2, Check, ExternalLink, Globe, Mail, Phone } from "lucide-react";
import { prisma } from "@/lib/db";
import { BrandEnrichmentStatus, type Prisma } from "@/lib/generated/prisma/client";
import { brandExportWhere, brandNameWhere, primaryProductArgs } from "@/lib/brands";
import { BrandsFilterBar } from "@/components/BrandsFilterBar";
import { EnrichAllButton } from "@/components/EnrichAllButton";
import { ExportBrandsButton } from "@/components/ExportBrandsButton";
import { StatusBadge } from "@/components/StatusBadge";
import { Pagination } from "@/components/Pagination";
import { avatarColorFor } from "@/lib/avatarColor";
import type { BrandSummary } from "@/lib/types";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 25;
const VALID_STATUSES = new Set<string>(Object.values(BrandEnrichmentStatus));

export default async function BrandsPage({
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
  const statusRaw = get("status");
  const status = VALID_STATUSES.has(statusRaw) ? (statusRaw as BrandEnrichmentStatus) : undefined;
  const exportedRaw = get("exported");
  const exported = exportedRaw === "no" || exportedRaw === "yes" ? exportedRaw : "";
  const page = Math.max(1, parseInt(get("page") || "1", 10) || 1);

  const where: Prisma.BrandWhereInput = {
    ...brandNameWhere(q),
    ...(status ? { enrichmentStatus: status } : {}),
    ...(exported === "no" ? { exportedAt: null } : {}),
    ...(exported === "yes" ? { exportedAt: { not: null } } : {}),
  };

  const [total, brands, needsEnrichmentCount, exportNewCount, exportAllCount] = await Promise.all([
    prisma.brand.count({ where }),
    prisma.brand.findMany({
      where,
      orderBy: { updatedAt: "desc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      include: { _count: { select: { products: true } }, products: primaryProductArgs },
    }),
    // Unfiltered — the button enriches every pending brand regardless of
    // whatever the current search/status filter happens to be showing.
    // Matches the enrich route's "needs-enrichment" query: excludes FOUND,
    // NOT_FOUND, and PARTIAL (each already checked once — don't keep
    // re-spending credits automatically on brands unlikely to resolve
    // differently).
    prisma.brand.count({
      where: { enrichmentStatus: { notIn: ["FOUND", "NOT_FOUND", "PARTIAL"] } },
    }),
    // What Export CSV would contain for the current search/status: Found and
    // Partial brands only, without and with the already-exported ones.
    prisma.brand.count({ where: brandExportWhere({ q, status, includeExported: false }) }),
    prisma.brand.count({ where: brandExportWhere({ q, status, includeExported: true }) }),
  ]);

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
    exportedAt: brand.exportedAt?.toISOString() ?? null,
    updatedAt: brand.updatedAt.toISOString(),
  }));

  const filterParams = new URLSearchParams();
  if (q) filterParams.set("q", q);
  if (status) filterParams.set("status", status);
  if (exported) filterParams.set("exported", exported);

  function buildPageHref(nextPage: number) {
    const p = new URLSearchParams(filterParams);
    if (nextPage > 1) p.set("page", String(nextPage));
    return `/brands?${p.toString()}`;
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
            newCount={exportNewCount}
            allCount={exportAllCount}
          />
          <EnrichAllButton count={needsEnrichmentCount} endpoint="/api/scrape/enrich" />
        </div>
      </div>

      <BrandsFilterBar />

      {total === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-slate-200 bg-white py-16 text-center">
          <Building2 className="h-8 w-8 text-slate-300" />
          <p className="text-sm text-slate-500">No brands yet — enrich some products first.</p>
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
                  <th className="px-6 py-3 font-medium">Status</th>
                  <th className="px-6 py-3 font-medium">Products</th>
                  <th className="px-6 py-3 font-medium">Updated</th>
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
