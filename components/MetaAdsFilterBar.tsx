"use client";

import { useState, type FormEvent } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { SlidersHorizontal } from "lucide-react";
import { Button } from "@/components/Button";

const inputClass =
  "rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 transition-colors focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-100";

export function MetaAdsFilterBar({ keywordOptions }: { keywordOptions: string[] }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [q, setQ] = useState(searchParams.get("q") ?? "");
  const [keyword, setKeyword] = useState(searchParams.get("keyword") ?? "");
  const [minActiveAds, setMinActiveAds] = useState(searchParams.get("minActiveAds") ?? "");

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const params = new URLSearchParams();
    if (q.trim()) params.set("q", q.trim());
    if (keyword) params.set("keyword", keyword);
    if (minActiveAds) params.set("minActiveAds", minActiveAds);
    const existingSort = searchParams.get("sort");
    if (existingSort) params.set("sort", existingSort);
    router.push(params.toString() ? `${pathname}?${params.toString()}` : pathname);
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="flex flex-wrap items-end gap-3 rounded-2xl border border-slate-200/70 bg-white p-4 shadow-sm shadow-slate-200/50"
    >
      <div className="flex flex-col gap-1">
        <label className="text-xs font-medium text-slate-500">Search page name</label>
        <input className={inputClass} value={q} onChange={(e) => setQ(e.target.value)} />
      </div>
      <div className="flex flex-col gap-1">
        <label className="text-xs font-medium text-slate-500">Product / keyword</label>
        <select className={inputClass} value={keyword} onChange={(e) => setKeyword(e.target.value)}>
          <option value="">All searches</option>
          {keywordOptions.map((k) => (
            <option key={k} value={k}>
              {k}
            </option>
          ))}
        </select>
      </div>
      <div className="flex flex-col gap-1">
        <label className="text-xs font-medium text-slate-500">Min active ads</label>
        <input
          className={`${inputClass} w-24`}
          type="number"
          min={1}
          value={minActiveAds}
          onChange={(e) => setMinActiveAds(e.target.value)}
        />
      </div>
      <Button type="submit" variant="secondary">
        <SlidersHorizontal className="h-3.5 w-3.5" />
        Apply filters
      </Button>
    </form>
  );
}
