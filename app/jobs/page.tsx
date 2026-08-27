import Link from "next/link";
import { History, Search, Sparkles, PackageSearch, Megaphone, Wand2 } from "lucide-react";
import { prisma } from "@/lib/db";
import { ScrapeJobStatus, ScrapeJobType, type Prisma } from "@/lib/generated/prisma/client";
import { summarizeJobInput } from "@/lib/jobs";
import { JobsFilterBar } from "@/components/JobsFilterBar";
import { StatusBadge } from "@/components/StatusBadge";
import { ProgressBar } from "@/components/ProgressBar";
import { Pagination } from "@/components/Pagination";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 25;
const VALID_TYPES = new Set<string>(Object.values(ScrapeJobType));
const VALID_STATUSES = new Set<string>(Object.values(ScrapeJobStatus));

const TYPE_META: Record<ScrapeJobType, { label: string; icon: typeof Search }> = {
  AMAZON_SEARCH: { label: "Search", icon: Search },
  BRAND_ENRICHMENT: { label: "Enrichment", icon: Sparkles },
  META_ADS_SEARCH: { label: "Ad Library", icon: Megaphone },
  META_ADS_ENRICHMENT: { label: "Ad Library enrichment", icon: Wand2 },
};

export default async function JobsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const get = (key: string) => {
    const value = params[key];
    return typeof value === "string" ? value : "";
  };

  const typeRaw = get("type");
  const type = VALID_TYPES.has(typeRaw) ? (typeRaw as ScrapeJobType) : undefined;
  const statusRaw = get("status");
  const status = VALID_STATUSES.has(statusRaw) ? (statusRaw as ScrapeJobStatus) : undefined;
  const page = Math.max(1, parseInt(get("page") || "1", 10) || 1);

  const where: Prisma.ScrapeJobWhereInput = {
    ...(type ? { type } : {}),
    ...(status ? { status } : {}),
  };

  const [total, jobs] = await Promise.all([
    prisma.scrapeJob.count({ where }),
    prisma.scrapeJob.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      include: { _count: { select: { products: true, metaAdBrands: true } } },
    }),
  ]);

  const exportParams = new URLSearchParams();
  if (type) exportParams.set("type", type);
  if (status) exportParams.set("status", status);

  function buildPageHref(nextPage: number) {
    const p = new URLSearchParams(exportParams);
    if (nextPage > 1) p.set("page", String(nextPage));
    return `/jobs?${p.toString()}`;
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Jobs</h1>
        <p className="mt-1 text-sm text-slate-500">
          Every search and enrichment run — {total} total.
        </p>
      </div>

      <JobsFilterBar />

      {total === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-slate-200 bg-white py-16 text-center">
          <History className="h-8 w-8 text-slate-300" />
          <p className="text-sm text-slate-500">No jobs yet — start a scrape.</p>
        </div>
      ) : (
        <>
          <div className="overflow-hidden rounded-2xl border border-slate-200/70 bg-white shadow-sm shadow-slate-200/50">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="text-left text-xs font-medium text-slate-400">
                  <th className="px-6 py-3 font-medium">Type</th>
                  <th className="px-6 py-3 font-medium">Summary</th>
                  <th className="px-6 py-3 font-medium">Status</th>
                  <th className="px-6 py-3 font-medium">Progress</th>
                  <th className="px-6 py-3 font-medium">Started</th>
                  <th className="px-6 py-3 font-medium"></th>
                </tr>
              </thead>
              <tbody>
                {jobs.map((job) => {
                  const typeMeta = TYPE_META[job.type];
                  const TypeIcon = typeMeta.icon;
                  return (
                  <tr key={job.id} className="border-t border-slate-100 hover:bg-slate-50/70">
                    <td className="px-6 py-3.5">
                      <span className="inline-flex items-center gap-1.5 text-slate-600">
                        <TypeIcon className="h-3.5 w-3.5 text-slate-400" />
                        {typeMeta.label}
                      </span>
                    </td>
                    <td className="px-6 py-3.5">
                      <Link
                        href={`/jobs/${job.id}`}
                        className="font-medium text-indigo-600 hover:text-indigo-700 hover:underline"
                      >
                        {summarizeJobInput(job)}
                      </Link>
                    </td>
                    <td className="px-6 py-3.5">
                      <StatusBadge status={job.status} />
                    </td>
                    <td className="px-6 py-3.5">
                      <div className="flex items-center gap-2">
                        <div className="w-24">
                          <ProgressBar value={job.progress} />
                        </div>
                        <span className="text-xs text-slate-500 tabular-nums">
                          {job.processedItems}/{job.totalItems}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-3.5 text-slate-500">{job.createdAt.toLocaleString()}</td>
                    <td className="px-6 py-3.5 text-right">
                      {job.type === "AMAZON_SEARCH" && job._count.products > 0 && (
                        <Link
                          href={`/products?jobId=${job.id}`}
                          className="inline-flex items-center gap-1 text-xs font-medium text-slate-500 hover:text-indigo-600"
                        >
                          <PackageSearch className="h-3.5 w-3.5" />
                          {job._count.products} product{job._count.products === 1 ? "" : "s"}
                        </Link>
                      )}
                      {job.type === "META_ADS_SEARCH" && job._count.metaAdBrands > 0 && (
                        <Link
                          href={`/ad-library?keyword=${encodeURIComponent(
                            typeof (job.input as { keyword?: unknown })?.keyword === "string"
                              ? (job.input as { keyword: string }).keyword
                              : ""
                          )}`}
                          className="inline-flex items-center gap-1 text-xs font-medium text-slate-500 hover:text-indigo-600"
                        >
                          <Megaphone className="h-3.5 w-3.5" />
                          {job._count.metaAdBrands} advertiser{job._count.metaAdBrands === 1 ? "" : "s"}
                        </Link>
                      )}
                    </td>
                  </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="flex items-center justify-between">
            <p className="text-xs text-slate-500">{total} job(s)</p>
            <Pagination page={page} hasNext={page * PAGE_SIZE < total} buildHref={buildPageHref} />
          </div>
        </>
      )}
    </div>
  );
}
