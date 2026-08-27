"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Megaphone, AlertCircle } from "lucide-react";
import { Button } from "@/components/Button";
import { postJson } from "@/lib/apiClient";
import type { StartJobResponse, StartMetaAdsSearchRequest } from "@/lib/types";

const inputClass =
  "w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 transition-colors focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-100";
const labelClass = "text-sm font-medium text-slate-700";

export default function NewAdLibrarySearchPage() {
  const router = useRouter();
  const [keyword, setKeyword] = useState("");
  const [minActiveAds, setMinActiveAds] = useState("3");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);

    if (!keyword.trim()) {
      setError("Enter a product/keyword to search for");
      return;
    }

    setSubmitting(true);
    const body: StartMetaAdsSearchRequest = {
      keyword: keyword.trim(),
      minActiveAds: Number(minActiveAds) || 1,
    };

    try {
      const { jobId } = await postJson<StartJobResponse>("/api/scrape/meta-ads", body);
      router.push(`/jobs/${jobId}`);
    } catch (err) {
      setError((err as Error).message);
      setSubmitting(false);
    }
  }

  return (
    <div className="max-w-xl">
      <div className="mb-6 flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 shadow-sm shadow-indigo-600/30">
          <Megaphone className="h-5 w-5 text-white" />
        </div>
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-slate-900">
            New Ad Library search
          </h1>
          <p className="text-sm text-slate-500">
            Find brands currently running Meta ads for a product.
          </p>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200/70 bg-white p-6 shadow-sm shadow-slate-200/50">
        {error && (
          <div className="mb-5 flex items-start gap-2 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2.5 text-sm text-rose-700">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="flex flex-col gap-5">
          <div className="flex flex-col gap-1.5">
            <label className={labelClass} htmlFor="keyword">
              Product / keyword
            </label>
            <input
              id="keyword"
              className={inputClass}
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              placeholder="e.g. silicone baking mat"
              autoFocus
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label className={labelClass} htmlFor="minActiveAds">
              Minimum currently-running ads
            </label>
            <input
              id="minActiveAds"
              type="number"
              min={1}
              className={`${inputClass} w-28`}
              value={minActiveAds}
              onChange={(e) => setMinActiveAds(e.target.value)}
            />
            <p className="text-xs text-slate-400">
              Only brands running at least this many active ads for this product get saved —
              a higher bar means a brand that&apos;s actively spending, not just testing one ad.
            </p>
          </div>

          <div>
            <Button type="submit" variant="primary" disabled={submitting}>
              {submitting ? "Starting…" : "Search Ad Library"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
