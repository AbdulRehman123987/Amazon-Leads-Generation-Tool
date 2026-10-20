import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, FileText, History, PackageSearch } from "lucide-react";
import { prisma } from "@/lib/db";
import { requirePageUser } from "@/lib/auth/currentUser";
import { isAdmin, ownedBy } from "@/lib/auth/access";
import { searchesForBrands } from "@/lib/brandSearches";
import { BrandEditForm } from "@/components/BrandEditForm";
import { StatusBadge } from "@/components/StatusBadge";
import { ScoreBadge } from "@/components/ScoreBadge";
import { avatarColorFor } from "@/lib/avatarColor";
import { MARKETPLACES } from "@/lib/amazon/marketplaces";

export const dynamic = "force-dynamic";

export default async function BrandDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await requirePageUser();
  const { id } = await params;
  // Someone else's brand looks exactly like one that doesn't exist.
  const brand = await prisma.brand.findFirst({
    where: { id, ...ownedBy(user) },
    include: {
      products: { orderBy: { createdAt: "desc" } },
      user: { select: { email: true } },
    },
  });
  if (!brand) notFound();

  const searches = (await searchesForBrands([brand.id])).get(brand.id) ?? [];

  return (
    <div className="flex max-w-3xl flex-col gap-6">
      <Link
        href="/brands"
        className="inline-flex w-fit items-center gap-1 text-sm text-slate-500 hover:text-slate-700"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        Brands
      </Link>

      <div className="flex items-center gap-4">
        <span
          className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl text-xl font-semibold ${avatarColorFor(brand.displayName)}`}
        >
          {brand.displayName.charAt(0).toUpperCase()}
        </span>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
            {brand.displayName}
          </h1>
          <div className="mt-1 flex flex-wrap items-center gap-2">
            <StatusBadge status={brand.enrichmentStatus} />
            {isAdmin(user) && (
              <span className="text-xs text-slate-400">Owner: {brand.user?.email ?? "unassigned"}</span>
            )}
          </div>
        </div>
      </div>

      {searches.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center gap-1 text-xs font-medium text-slate-400">
            <History className="h-3.5 w-3.5" />
            Found via:
          </span>
          {searches.map((search) => (
            <Link
              key={search.jobId}
              href={`/jobs/${search.jobId}`}
              title="Open this search"
              className="rounded-full bg-indigo-50 px-2.5 py-1 text-xs font-medium text-indigo-700 hover:bg-indigo-100"
            >
              {search.label}
            </Link>
          ))}
        </div>
      )}

      <BrandEditForm
        brandId={brand.id}
        brandName={brand.displayName}
        initialWebsiteUrl={brand.websiteUrl}
        initialEmail={brand.email}
        initialPhone={brand.phone}
        initialStatus={brand.enrichmentStatus}
      />

      <div className="rounded-2xl border border-slate-200/70 bg-white p-6 shadow-sm shadow-slate-200/50">
        <div className="mb-3 flex items-center gap-1.5 text-sm font-semibold text-slate-900">
          <FileText className="h-4 w-4 text-slate-400" />
          Raw notes / debug info
        </div>
        <pre className="whitespace-pre-wrap rounded-xl bg-slate-50 p-4 font-mono text-xs leading-relaxed text-slate-600">
          {brand.rawNotes || "No notes yet."}
        </pre>
      </div>

      <div className="rounded-2xl border border-slate-200/70 bg-white shadow-sm shadow-slate-200/50">
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
          <h2 className="text-sm font-semibold text-slate-900">
            Linked products ({brand.products.length})
          </h2>
          {brand.products.length > 0 && (
            <Link
              href={`/products?brandId=${brand.id}`}
              className="inline-flex items-center gap-1.5 text-xs font-medium text-indigo-600 hover:underline"
            >
              <PackageSearch className="h-3.5 w-3.5" />
              View in Products
            </Link>
          )}
        </div>
        {brand.products.length === 0 ? (
          <p className="px-6 py-8 text-center text-sm text-slate-500">No linked products.</p>
        ) : (
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="text-left text-xs font-medium text-slate-400">
                <th className="px-6 py-2.5 font-medium">Title</th>
                <th className="px-6 py-2.5 font-medium">ASIN</th>
                <th className="px-6 py-2.5 font-medium">Score</th>
              </tr>
            </thead>
            <tbody>
              {brand.products.map((product) => (
                <tr key={product.id} className="border-t border-slate-100 hover:bg-slate-50/70">
                  <td className="max-w-xs truncate px-6 py-3">
                    <a
                      href={product.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-slate-700 hover:text-indigo-600"
                    >
                      {product.title}
                    </a>
                  </td>
                  <td className="px-6 py-3 font-mono text-xs text-slate-400">
                    {product.asin}
                    <span
                      className="ml-2 rounded bg-slate-100 px-1.5 py-0.5 font-sans text-[10px] font-semibold tracking-wide text-slate-500"
                      title={MARKETPLACES[product.marketplace].domain}
                    >
                      {product.marketplace}
                    </span>
                  </td>
                  <td className="px-6 py-3">
                    <ScoreBadge score={product.lowSaleScore} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
