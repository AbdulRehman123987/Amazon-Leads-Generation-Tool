import Link from "next/link";
import { Download, PackageSearch, X } from "lucide-react";
import { prisma } from "@/lib/db";
import { BrandEnrichmentStatus, type Prisma } from "@/lib/generated/prisma/client";
import { jobLabel } from "@/lib/jobs";
import { topLevelCategory } from "@/lib/category";
import { ProductsFilterBar } from "@/components/ProductsFilterBar";
import { SearchChips } from "@/components/SearchChips";
import { ProductsGrid } from "@/components/ProductsGrid";
import { Pagination } from "@/components/Pagination";
import type { JobOption, ProductRow } from "@/lib/types";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 24;
const MAX_SEARCH_CHIPS = 8;
const VALID_BRAND_STATUSES = new Set<string>(Object.values(BrandEnrichmentStatus));

function parseSort(raw: string): Prisma.ProductOrderByWithRelationInput {
  const direction: Prisma.SortOrder = raw.startsWith("-") ? "desc" : "asc";
  const field = raw.replace(/^-/, "");
  if (field === "reviewCount") return { reviewCount: direction };
  if (field === "bsr") return { bsr: direction };
  return { lowSaleScore: direction };
}

export default async function ProductsPage({
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
  const brandStatusRaw = get("brandStatus");
  const brandStatus = VALID_BRAND_STATUSES.has(brandStatusRaw)
    ? (brandStatusRaw as BrandEnrichmentStatus)
    : undefined;
  const minScore = get("minScore");
  const maxScore = get("maxScore");
  const jobId = get("jobId");
  const category = get("category");
  const brandId = get("brandId");
  const page = Math.max(1, parseInt(get("page") || "1", 10) || 1);
  const sortParam = get("sort") || "-lowSaleScore";

  const where: Prisma.ProductWhereInput = {
    ...(q ? { title: { contains: q, mode: "insensitive" } } : {}),
    ...(minScore || maxScore
      ? {
          lowSaleScore: {
            ...(minScore ? { gte: parseFloat(minScore) } : {}),
            ...(maxScore ? { lte: parseFloat(maxScore) } : {}),
          },
        }
      : {}),
    ...(brandStatus ? { brand: { enrichmentStatus: brandStatus } } : {}),
    ...(jobId ? { scrapeJobId: jobId } : {}),
    ...(category ? { category: { startsWith: category } } : {}),
    ...(brandId ? { brandId } : {}),
  };

  const [total, products, searchJobs, rawCategories, activeBrand] = await Promise.all([
    prisma.product.count({ where }),
    prisma.product.findMany({
      where,
      orderBy: parseSort(sortParam),
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      include: { brand: { select: { id: true, displayName: true, enrichmentStatus: true } } },
    }),
    prisma.scrapeJob.findMany({
      where: { type: "AMAZON_SEARCH", products: { some: {} } },
      orderBy: { createdAt: "desc" },
      include: { _count: { select: { products: true } } },
      take: 20,
    }),
    prisma.product.findMany({
      where: { category: { not: null } },
      select: { category: true },
      distinct: ["category"],
    }),
    brandId ? prisma.brand.findUnique({ where: { id: brandId }, select: { displayName: true } }) : null,
  ]);

  const jobOptions: JobOption[] = searchJobs.map((job) => ({
    id: job.id,
    label: jobLabel(job),
    productCount: job._count.products,
  }));

  const categoryOptions = [
    ...new Set(rawCategories.map((p) => topLevelCategory(p.category)).filter((c): c is string => !!c)),
  ].sort();

  const rows: ProductRow[] = products.map((product) => ({
    id: product.id,
    asin: product.asin,
    title: product.title,
    url: product.url,
    imageUrl: product.imageUrl,
    price: product.price,
    currency: product.currency,
    reviewCount: product.reviewCount,
    bsr: product.bsr,
    category: product.category,
    lowSaleScore: product.lowSaleScore,
    scrapeJobId: product.scrapeJobId,
    brand: product.brand,
  }));

  const baseParams = new URLSearchParams();
  if (q) baseParams.set("q", q);
  if (brandStatus) baseParams.set("brandStatus", brandStatus);
  if (minScore) baseParams.set("minScore", minScore);
  if (maxScore) baseParams.set("maxScore", maxScore);
  if (category) baseParams.set("category", category);
  if (brandId) baseParams.set("brandId", brandId);

  const exportParams = new URLSearchParams(baseParams);
  if (jobId) exportParams.set("jobId", jobId);

  function buildPageHref(nextPage: number) {
    const p = new URLSearchParams(exportParams);
    p.set("sort", sortParam);
    if (nextPage > 1) p.set("page", String(nextPage));
    return `/products?${p.toString()}`;
  }

  function buildJobChipHref(nextJobId: string) {
    const p = new URLSearchParams(baseParams);
    if (nextJobId) p.set("jobId", nextJobId);
    p.set("sort", sortParam);
    return `/products?${p.toString()}`;
  }

  function clearHref(key: "brandId" | "jobId") {
    const p = new URLSearchParams(exportParams);
    p.delete(key);
    p.set("sort", sortParam);
    return `/products?${p.toString()}`;
  }

  const activeJob = jobId ? jobOptions.find((j) => j.id === jobId) : undefined;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Products</h1>
          <p className="mt-1 text-sm text-slate-500">{total} scraped listing(s)</p>
        </div>
        <a
          href={`/api/export/products?${exportParams.toString()}`}
          className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-sm font-medium text-slate-700 shadow-sm transition-colors hover:border-slate-300 hover:bg-slate-50"
        >
          <Download className="h-4 w-4" />
          Export CSV
        </a>
      </div>

      <SearchChips
        jobs={jobOptions.slice(0, MAX_SEARCH_CHIPS)}
        activeJobId={jobId}
        buildHref={buildJobChipHref}
      />

      {(activeJob || activeBrand) && (
        <div className="flex flex-wrap items-center gap-2">
          {activeJob && (
            <span className="inline-flex items-center gap-2 rounded-lg bg-indigo-50 py-1.5 pl-3 pr-1.5 text-sm text-indigo-700">
              Search: <Link href={`/jobs/${activeJob.id}`} className="font-medium hover:underline">{activeJob.label}</Link>
              <Link href={clearHref("jobId")} className="rounded p-1 hover:bg-indigo-100" aria-label="Clear search filter">
                <X className="h-3.5 w-3.5" />
              </Link>
            </span>
          )}
          {activeBrand && (
            <span className="inline-flex items-center gap-2 rounded-lg bg-indigo-50 py-1.5 pl-3 pr-1.5 text-sm text-indigo-700">
              Brand: <span className="font-medium">{activeBrand.displayName}</span>
              <Link href={clearHref("brandId")} className="rounded p-1 hover:bg-indigo-100" aria-label="Clear brand filter">
                <X className="h-3.5 w-3.5" />
              </Link>
            </span>
          )}
        </div>
      )}

      <ProductsFilterBar jobOptions={jobOptions} categoryOptions={categoryOptions} />

      {total === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-slate-200 bg-white py-16 text-center">
          <PackageSearch className="h-8 w-8 text-slate-300" />
          <p className="text-sm text-slate-500">
            {jobId || brandId || q || category || brandStatus
              ? "No products match these filters."
              : "No products yet — start a scrape."}
          </p>
        </div>
      ) : (
        <>
          <ProductsGrid products={rows} />
          <div className="flex items-center justify-between">
            <p className="text-xs text-slate-500">{total} product(s)</p>
            <Pagination page={page} hasNext={page * PAGE_SIZE < total} buildHref={buildPageHref} />
          </div>
        </>
      )}
    </div>
  );
}
