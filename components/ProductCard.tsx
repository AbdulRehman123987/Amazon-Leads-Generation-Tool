import Link from "next/link";
import { ImageOff, Check, MessageSquare, TrendingDown } from "lucide-react";
import { StatusBadge } from "@/components/StatusBadge";
import { ScoreBadge } from "@/components/ScoreBadge";
import { topLevelCategory } from "@/lib/category";
import type { ProductRow } from "@/lib/types";

export function ProductCard({
  product,
  selected,
  onToggle,
}: {
  product: ProductRow;
  selected: boolean;
  onToggle: () => void;
}) {
  return (
    <div
      className={`group flex flex-col overflow-hidden rounded-2xl border bg-white shadow-sm shadow-slate-200/50 transition-all hover:shadow-md ${
        selected
          ? "border-indigo-400 ring-2 ring-indigo-100"
          : "border-slate-200/70 hover:border-slate-300"
      }`}
    >
      <div className="relative aspect-square bg-slate-50">
        {product.imageUrl ? (
          // Amazon CDN image, arbitrary host — plain <img> avoids remotePatterns config.
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={product.imageUrl}
            alt={product.title}
            className="h-full w-full object-contain p-4"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-slate-300">
            <ImageOff className="h-10 w-10" />
          </div>
        )}

        <button
          type="button"
          onClick={onToggle}
          aria-label={selected ? "Deselect" : "Select"}
          aria-pressed={selected}
          className={`absolute left-2.5 top-2.5 flex h-6 w-6 items-center justify-center rounded-md border-2 shadow-sm transition-colors ${
            selected ? "border-indigo-600 bg-indigo-600" : "border-white bg-white/90 backdrop-blur"
          }`}
        >
          {selected && <Check className="h-4 w-4 text-white" />}
        </button>

        <div className="absolute right-2.5 top-2.5">
          <ScoreBadge score={product.lowSaleScore} />
        </div>
      </div>

      <div className="flex flex-1 flex-col gap-2 p-4">
        <a
          href={product.url}
          target="_blank"
          rel="noopener noreferrer"
          className="line-clamp-2 min-h-[2.5rem] text-sm font-medium text-slate-800 hover:text-indigo-600"
          title={product.title}
        >
          {product.title}
        </a>
        <div className="flex items-center gap-2">
          <p className="font-mono text-xs text-slate-400">{product.asin}</p>
          {product.category && (
            <Link
              href={`/products?category=${encodeURIComponent(topLevelCategory(product.category) ?? "")}`}
              className="truncate rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-500 hover:bg-slate-200"
              title={product.category}
            >
              {topLevelCategory(product.category)}
            </Link>
          )}
        </div>

        <div className="mt-1 flex items-center justify-between">
          <span className="text-sm font-semibold text-slate-900 tabular-nums">
            {product.price != null ? `${product.currency ?? "$"}${product.price.toFixed(2)}` : "—"}
          </span>
          <div className="flex items-center gap-3 text-xs text-slate-500">
            <span className="flex items-center gap-1 tabular-nums">
              <MessageSquare className="h-3.5 w-3.5" />
              {product.reviewCount ?? "—"}
            </span>
            <span className="flex items-center gap-1 tabular-nums">
              <TrendingDown className="h-3.5 w-3.5" />
              {product.bsr ?? "—"}
            </span>
          </div>
        </div>

        <div className="mt-auto flex items-center justify-between border-t border-slate-100 pt-3">
          {product.brand ? (
            <Link
              href={`/brands/${product.brand.id}`}
              className="truncate pr-2 text-sm font-medium text-indigo-600 hover:underline"
            >
              {product.brand.displayName}
            </Link>
          ) : (
            <span className="text-sm text-slate-400">No brand</span>
          )}
          {product.brand && <StatusBadge status={product.brand.enrichmentStatus} />}
        </div>
      </div>
    </div>
  );
}
