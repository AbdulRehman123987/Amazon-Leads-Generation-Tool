"use client";

import { useState, type FormEvent } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { SlidersHorizontal } from "lucide-react";
import { Button } from "@/components/Button";
import type { JobOption } from "@/lib/types";

const STATUS_OPTIONS = ["NOT_STARTED", "IN_PROGRESS", "FOUND", "PARTIAL", "NOT_FOUND"];

const EXPORTED_OPTIONS = [
  { value: "", label: "Any" },
  { value: "no", label: "Not exported yet" },
  { value: "yes", label: "Already exported" },
];

const inputClass =
  "rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 transition-colors focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-100";

export function BrandsFilterBar({ jobOptions }: { jobOptions: JobOption[] }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [q, setQ] = useState(searchParams.get("q") ?? "");
  const [status, setStatus] = useState(searchParams.get("status") ?? "");
  const [exported, setExported] = useState(searchParams.get("exported") ?? "");
  const [jobId, setJobId] = useState(searchParams.get("jobId") ?? "");

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const params = new URLSearchParams();
    if (q.trim()) params.set("q", q.trim());
    if (status) params.set("status", status);
    if (exported) params.set("exported", exported);
    if (jobId) params.set("jobId", jobId);
    router.push(params.toString() ? `${pathname}?${params.toString()}` : pathname);
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="flex flex-wrap items-end gap-3 rounded-2xl border border-slate-200/70 bg-white p-4 shadow-sm shadow-slate-200/50"
    >
      <div className="flex flex-col gap-1">
        <label className="text-xs font-medium text-slate-500">Search name</label>
        <input className={inputClass} value={q} onChange={(e) => setQ(e.target.value)} />
      </div>
      <div className="flex flex-col gap-1">
        <label className="text-xs font-medium text-slate-500">Found via search</label>
        <select className={inputClass} value={jobId} onChange={(e) => setJobId(e.target.value)}>
          <option value="">All searches</option>
          {jobOptions.map((job) => (
            <option key={job.id} value={job.id}>
              {job.label} ({job.count})
            </option>
          ))}
        </select>
      </div>
      <div className="flex flex-col gap-1">
        <label className="text-xs font-medium text-slate-500">Status</label>
        <select className={inputClass} value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="">Any</option>
          {STATUS_OPTIONS.map((option) => (
            <option key={option} value={option}>
              {option.replace(/_/g, " ")}
            </option>
          ))}
        </select>
      </div>
      <div className="flex flex-col gap-1">
        <label className="text-xs font-medium text-slate-500">Exported</label>
        <select className={inputClass} value={exported} onChange={(e) => setExported(e.target.value)}>
          {EXPORTED_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </div>
      <Button type="submit" variant="secondary">
        <SlidersHorizontal className="h-3.5 w-3.5" />
        Apply filters
      </Button>
    </form>
  );
}
