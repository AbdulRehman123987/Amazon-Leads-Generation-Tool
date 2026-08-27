"use client";

import { useState, type FormEvent } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { SlidersHorizontal } from "lucide-react";
import { Button } from "@/components/Button";
import type { JobOption } from "@/lib/types";

const BRAND_STATUS_OPTIONS = [
  "NOT_STARTED",
  "IN_PROGRESS",
  "FOUND",
  "PARTIAL",
  "NOT_FOUND",
];

const inputClass =
  "rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 transition-colors focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-100";

export function ProductsFilterBar({
  jobOptions,
  categoryOptions,
}: {
  jobOptions: JobOption[];
  categoryOptions: string[];
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [q, setQ] = useState(searchParams.get("q") ?? "");
  const [brandStatus, setBrandStatus] = useState(searchParams.get("brandStatus") ?? "");
  const [minScore, setMinScore] = useState(searchParams.get("minScore") ?? "");
  const [maxScore, setMaxScore] = useState(searchParams.get("maxScore") ?? "");
  const [jobId, setJobId] = useState(searchParams.get("jobId") ?? "");
  const [category, setCategory] = useState(searchParams.get("category") ?? "");

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const params = new URLSearchParams();
    if (q.trim()) params.set("q", q.trim());
    if (brandStatus) params.set("brandStatus", brandStatus);
    if (minScore) params.set("minScore", minScore);
    if (maxScore) params.set("maxScore", maxScore);
    if (jobId) params.set("jobId", jobId);
    if (category) params.set("category", category);
    const brandId = searchParams.get("brandId");
    if (brandId) params.set("brandId", brandId);
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
        <label className="text-xs font-medium text-slate-500">Search title</label>
        <input className={inputClass} value={q} onChange={(e) => setQ(e.target.value)} />
      </div>
      <div className="flex flex-col gap-1">
        <label className="text-xs font-medium text-slate-500">Search (job)</label>
        <select className={inputClass} value={jobId} onChange={(e) => setJobId(e.target.value)}>
          <option value="">All searches</option>
          {jobOptions.map((job) => (
            <option key={job.id} value={job.id}>
              {job.label} ({job.productCount})
            </option>
          ))}
        </select>
      </div>
      <div className="flex flex-col gap-1">
        <label className="text-xs font-medium text-slate-500">Category</label>
        <select className={inputClass} value={category} onChange={(e) => setCategory(e.target.value)}>
          <option value="">Any</option>
          {categoryOptions.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
      </div>
      <div className="flex flex-col gap-1">
        <label className="text-xs font-medium text-slate-500">Brand status</label>
        <select
          className={inputClass}
          value={brandStatus}
          onChange={(e) => setBrandStatus(e.target.value)}
        >
          <option value="">Any</option>
          {BRAND_STATUS_OPTIONS.map((status) => (
            <option key={status} value={status}>
              {status.replace(/_/g, " ")}
            </option>
          ))}
        </select>
      </div>
      <div className="flex flex-col gap-1">
        <label className="text-xs font-medium text-slate-500">Min score</label>
        <input
          className={`${inputClass} w-20`}
          type="number"
          step="0.01"
          min={0}
          max={1}
          value={minScore}
          onChange={(e) => setMinScore(e.target.value)}
        />
      </div>
      <div className="flex flex-col gap-1">
        <label className="text-xs font-medium text-slate-500">Max score</label>
        <input
          className={`${inputClass} w-20`}
          type="number"
          step="0.01"
          min={0}
          max={1}
          value={maxScore}
          onChange={(e) => setMaxScore(e.target.value)}
        />
      </div>
      <Button type="submit" variant="secondary">
        <SlidersHorizontal className="h-3.5 w-3.5" />
        Apply filters
      </Button>
    </form>
  );
}
