import Link from "next/link";
import { Download, Building2, Globe, Mail, Phone } from "lucide-react";
import { prisma } from "@/lib/db";
import { BrandEnrichmentStatus, type Prisma } from "@/lib/generated/prisma/client";
import { BrandsFilterBar } from "@/components/BrandsFilterBar";
import { EnrichAllButton } from "@/components/EnrichAllButton";
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
  const page = Math.max(1, parseInt(get("page") || "1", 10) || 1);

  const where: Prisma.BrandWhereInput = {
    ...(q
      ? {
          OR: [
            { displayName: { contains: q, mode: "insensitive" } },
            { name: { contains: q.toLowerCase(), mode: "insensitive" } },
          ],
        }
      : {}),
    ...(status ? { enrichmentStatus: status } : {}),
  };

  const [total, brands, needsEnrichmentCount] = await Promise.all([
    prisma.brand.count({ where }),
    prisma.brand.findMany({
      where,
      orderBy: { updatedAt: "desc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      include: { _count: { select: { products: true } } },
    }),
    // Unfiltered — the button enriches every pending brand regardless of
    // whatever the current search/status filter happens to be showing.
    // Matches the enrich route's "needs-enrichment" query: excludes FOUND
    // (done) and NOT_FOUND (already tried, don't keep re-spending credits).
    prisma.brand.count({ where: { enrichmentStatus: { notIn: ["FOUND", "NOT_FOUND"] } } }),
  ]);

  const rows: BrandSummary[] = brands.map((brand) => ({
    id: brand.id,
    name: brand.name,
    displayName: brand.displayName,
    websiteUrl: brand.websiteUrl,
    email: brand.email,
    phone: brand.phone,
    enrichmentStatus: brand.enrichmentStatus,
    productCount: brand._count.products,
    updatedAt: brand.updatedAt.toISOString(),
  }));

  const exportParams = new URLSearchParams();
  if (q) exportParams.set("q", q);
  if (status) exportParams.set("status", status);

  function buildPageHref(nextPage: number) {
    const p = new URLSearchParams(exportParams);
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
          <a
            href={`/api/export/brands?${exportParams.toString()}`}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-sm font-medium text-slate-700 shadow-sm transition-colors hover:border-slate-300 hover:bg-slate-50"
          >
            <Download className="h-4 w-4" />
            Export CSV
          </a>
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
          <div className="overflow-hidden rounded-2xl border border-slate-200/70 bg-white shadow-sm shadow-slate-200/50">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="text-left text-xs font-medium text-slate-400">
                  <th className="px-6 py-3 font-medium">Name</th>
                  <th className="px-6 py-3 font-medium">Website</th>
                  <th className="px-6 py-3 font-medium">Email</th>
                  <th className="px-6 py-3 font-medium">Phone</th>
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
                      <StatusBadge status={brand.enrichmentStatus} />
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
