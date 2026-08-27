"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Search, SlidersHorizontal, AlertCircle } from "lucide-react";
import { Button } from "@/components/Button";
import { useToast } from "@/components/Toast";
import { postJson } from "@/lib/apiClient";
import type { StartAmazonScrapeRequest, StartJobResponse } from "@/lib/types";

const inputClass =
  "w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 transition-colors focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-100";
const labelClass = "text-sm font-medium text-slate-700";

export default function NewScrapePage() {
  const router = useRouter();
  const toast = useToast();
  const [keyword, setKeyword] = useState("");
  const [categoryUrl, setCategoryUrl] = useState("");
  const [maxPages, setMaxPages] = useState("2");
  const [maxReviews, setMaxReviews] = useState("");
  const [minBsr, setMinBsr] = useState("");
  const [maxBsr, setMaxBsr] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);

    if (!keyword.trim() && !categoryUrl.trim()) {
      setError("Provide either a keyword or a category URL");
      return;
    }

    setSubmitting(true);
    const body: StartAmazonScrapeRequest = {
      keyword: keyword.trim() || undefined,
      categoryUrl: categoryUrl.trim() || undefined,
      maxPages: Number(maxPages) || 1,
      maxReviews: maxReviews ? Number(maxReviews) : undefined,
      minBsr: minBsr ? Number(minBsr) : undefined,
      maxBsr: maxBsr ? Number(maxBsr) : undefined,
    };

    try {
      const { jobId } = await postJson<StartJobResponse>("/api/scrape/amazon", body);
      toast.success("Scrape started.");
      router.push(`/jobs/${jobId}`);
    } catch (err) {
      toast.error((err as Error).message);
      setSubmitting(false);
    }
  }

  return (
    <div className="max-w-xl">
      <div className="mb-6 flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 shadow-sm shadow-indigo-600/30">
          <Search className="h-5 w-5 text-white" />
        </div>
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-slate-900">
            New Amazon scrape
          </h1>
          <p className="text-sm text-slate-500">Find low-review, low-rank products to target.</p>
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
              Keyword
            </label>
            <input
              id="keyword"
              className={inputClass}
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              placeholder="e.g. silicone baking mat"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label className={labelClass} htmlFor="categoryUrl">
              Category URL <span className="font-normal text-slate-400">(optional, used instead of keyword)</span>
            </label>
            <input
              id="categoryUrl"
              className={`${inputClass} font-mono text-xs`}
              value={categoryUrl}
              onChange={(e) => setCategoryUrl(e.target.value)}
              placeholder="https://www.amazon.com/s?..."
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label className={labelClass} htmlFor="maxPages">
              Max pages
            </label>
            <input
              id="maxPages"
              type="number"
              min={1}
              max={10}
              className={`${inputClass} w-24`}
              value={maxPages}
              onChange={(e) => setMaxPages(e.target.value)}
            />
          </div>

          <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-4">
            <div className="mb-3 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-slate-500">
              <SlidersHorizontal className="h-3.5 w-3.5" />
              Low-sale thresholds (optional)
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className="flex flex-col gap-1.5">
                <label className={labelClass} htmlFor="maxReviews">
                  Max reviews
                </label>
                <input
                  id="maxReviews"
                  type="number"
                  min={0}
                  className={inputClass}
                  value={maxReviews}
                  onChange={(e) => setMaxReviews(e.target.value)}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className={labelClass} htmlFor="minBsr">
                  Min BSR
                </label>
                <input
                  id="minBsr"
                  type="number"
                  min={0}
                  className={inputClass}
                  value={minBsr}
                  onChange={(e) => setMinBsr(e.target.value)}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className={labelClass} htmlFor="maxBsr">
                  Max BSR
                </label>
                <input
                  id="maxBsr"
                  type="number"
                  min={0}
                  className={inputClass}
                  value={maxBsr}
                  onChange={(e) => setMaxBsr(e.target.value)}
                />
              </div>
            </div>
          </div>

          <div>
            <Button type="submit" variant="primary" disabled={submitting}>
              {submitting ? "Starting…" : "Start scrape"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
