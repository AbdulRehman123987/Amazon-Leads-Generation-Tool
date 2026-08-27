"use client";

import { useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Sparkles, ArrowUpDown } from "lucide-react";
import { Button } from "@/components/Button";
import { ProductCard } from "@/components/ProductCard";
import { useToast } from "@/components/Toast";
import { postJson } from "@/lib/apiClient";
import type { ProductRow, StartJobResponse } from "@/lib/types";

const SORT_OPTIONS = [
  { value: "-lowSaleScore", label: "Score: high to low" },
  { value: "lowSaleScore", label: "Score: low to high" },
  { value: "reviewCount", label: "Reviews: fewest first" },
  { value: "-reviewCount", label: "Reviews: most first" },
  { value: "-bsr", label: "BSR: worst first" },
  { value: "bsr", label: "BSR: best first" },
];

export function ProductsGrid({ products }: { products: ProductRow[] }) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [enriching, setEnriching] = useState(false);
  const router = useRouter();
  const toast = useToast();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const currentSort = searchParams.get("sort") ?? "-lowSaleScore";

  function handleSortChange(value: string) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("sort", value);
    params.delete("page");
    router.push(`${pathname}?${params.toString()}`);
  }

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleAll() {
    setSelected((prev) =>
      prev.size === products.length ? new Set() : new Set(products.map((p) => p.id))
    );
  }

  async function handleBulkEnrich() {
    setEnriching(true);
    try {
      const { jobId } = await postJson<StartJobResponse>("/api/scrape/enrich", {
        productIds: [...selected],
      });
      toast.success(`Enrichment started for ${selected.size} brand${selected.size === 1 ? "" : "s"}.`);
      router.push(`/jobs/${jobId}`);
    } catch (err) {
      toast.error((err as Error).message);
      setEnriching(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200/70 bg-white px-4 py-3 shadow-sm shadow-slate-200/50">
        <label className="flex items-center gap-2 text-sm text-slate-600">
          <input
            type="checkbox"
            checked={products.length > 0 && selected.size === products.length}
            onChange={toggleAll}
            className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-2 focus:ring-indigo-200"
          />
          {selected.size > 0 ? `${selected.size} selected` : "Select all"}
        </label>

        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-1.5">
            <ArrowUpDown className="h-3.5 w-3.5 text-slate-400" />
            <select
              value={currentSort}
              onChange={(e) => handleSortChange(e.target.value)}
              className="rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-sm text-slate-700 focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-100"
            >
              {SORT_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
          <Button
            variant="primary"
            disabled={selected.size === 0 || enriching}
            onClick={handleBulkEnrich}
          >
            <Sparkles className="h-4 w-4" />
            {enriching ? "Starting…" : `Enrich selected (${selected.size})`}
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {products.map((product) => (
          <ProductCard
            key={product.id}
            product={product}
            selected={selected.has(product.id)}
            onToggle={() => toggle(product.id)}
          />
        ))}
      </div>
    </div>
  );
}
