"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  Sparkles,
  ListChecks,
  AlertTriangle,
  TrendingUp,
  PackageSearch,
  Megaphone,
} from "lucide-react";
import { Button } from "@/components/Button";
import { StatusBadge } from "@/components/StatusBadge";
import { ProgressBar } from "@/components/ProgressBar";
import { postJson } from "@/lib/apiClient";
import { summarizeJobInput } from "@/lib/jobSummary";
import type { ScrapeJobType } from "@/lib/generated/prisma/client";
import type { JobDetail, JobLogEntry, StartJobResponse } from "@/lib/types";

const POLL_INTERVAL_MS = 2500;
const ACTIVE_STATUSES = new Set(["PENDING", "RUNNING"]);

const LOG_LEVEL_STYLES: Record<JobLogEntry["level"], string> = {
  info: "text-slate-300",
  warn: "text-amber-300",
  error: "text-rose-300",
};

const JOB_TYPE_LABEL: Record<ScrapeJobType, string> = {
  AMAZON_SEARCH: "Search",
  BRAND_ENRICHMENT: "Brand enrichment",
  META_ADS_SEARCH: "Ad Library search",
  META_ADS_ENRICHMENT: "Ad Library enrichment",
};

export function JobLiveView({
  initialJob,
  resultCount,
}: {
  initialJob: JobDetail;
  /** Products found (AMAZON_SEARCH) or advertisers found (META_ADS_SEARCH). */
  resultCount: number;
}) {
  const [job, setJob] = useState(initialJob);
  const [enriching, setEnriching] = useState(false);
  const [enrichError, setEnrichError] = useState<string | null>(null);
  const router = useRouter();
  const logRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!ACTIVE_STATUSES.has(job.status)) return;
    const interval = setInterval(async () => {
      try {
        const res = await fetch(`/api/jobs/${job.id}`, { cache: "no-store" });
        if (!res.ok) return;
        const data: JobDetail = await res.json();
        setJob(data);
      } catch {
        // transient network error — the next tick will retry
      }
    }, POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [job.status, job.id]);

  useEffect(() => {
    logRef.current?.scrollTo({ top: logRef.current.scrollHeight, behavior: "smooth" });
  }, [job.logs.length]);

  async function handleEnrich() {
    setEnrichError(null);
    setEnriching(true);
    try {
      const { jobId } = await postJson<StartJobResponse>("/api/scrape/enrich", {
        jobId: job.id,
      });
      router.push(`/jobs/${jobId}`);
    } catch (err) {
      setEnrichError((err as Error).message);
      setEnriching(false);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <Link
        href="/jobs"
        className="inline-flex w-fit items-center gap-1 text-sm text-slate-500 hover:text-slate-700"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        Jobs
      </Link>

      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
            {JOB_TYPE_LABEL[job.type]}
          </p>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
            {summarizeJobInput(job)}
          </h1>
          <p className="mt-1 font-mono text-xs text-slate-400">{job.id}</p>
        </div>
        <div className="flex flex-col items-end gap-1.5">
          {job.type === "AMAZON_SEARCH" && resultCount > 0 && (
            <Link
              href={`/products?jobId=${job.id}`}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-sm font-medium text-slate-700 shadow-sm transition-colors hover:border-slate-300 hover:bg-slate-50"
            >
              <PackageSearch className="h-4 w-4" />
              View {resultCount} product{resultCount === 1 ? "" : "s"} from this search
            </Link>
          )}
          {job.type === "META_ADS_SEARCH" && resultCount > 0 && (
            <Link
              href={`/ad-library?keyword=${encodeURIComponent(
                typeof job.input.keyword === "string" ? job.input.keyword : ""
              )}`}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-sm font-medium text-slate-700 shadow-sm transition-colors hover:border-slate-300 hover:bg-slate-50"
            >
              <Megaphone className="h-4 w-4" />
              View {resultCount} advertiser{resultCount === 1 ? "" : "s"} in Ad Library
            </Link>
          )}
          {job.type === "AMAZON_SEARCH" && job.status === "COMPLETED" && (
            <>
              <Button variant="primary" onClick={handleEnrich} disabled={enriching}>
                <Sparkles className="h-4 w-4" />
                {enriching ? "Starting…" : "Enrich brands for these results"}
              </Button>
              {enrichError && <p className="text-xs text-rose-600">{enrichError}</p>}
            </>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <div className="rounded-2xl border border-slate-200/70 bg-white p-4 shadow-sm shadow-slate-200/50">
          <div className="text-xs font-medium text-slate-400">Status</div>
          <div className="mt-2">
            <StatusBadge status={job.status} />
          </div>
        </div>
        <div className="rounded-2xl border border-slate-200/70 bg-white p-4 shadow-sm shadow-slate-200/50">
          <div className="flex items-center gap-1.5 text-xs font-medium text-slate-400">
            <ListChecks className="h-3.5 w-3.5" />
            Processed
          </div>
          <div className="mt-1.5 text-lg font-semibold tabular-nums text-slate-900">
            {job.processedItems} / {job.totalItems}
          </div>
        </div>
        <div className="rounded-2xl border border-slate-200/70 bg-white p-4 shadow-sm shadow-slate-200/50">
          <div className="flex items-center gap-1.5 text-xs font-medium text-slate-400">
            <AlertTriangle className="h-3.5 w-3.5" />
            Errors
          </div>
          <div
            className={`mt-1.5 text-lg font-semibold tabular-nums ${job.errorCount > 0 ? "text-rose-600" : "text-slate-900"}`}
          >
            {job.errorCount}
          </div>
        </div>
        <div className="rounded-2xl border border-slate-200/70 bg-white p-4 shadow-sm shadow-slate-200/50">
          <div className="flex items-center gap-1.5 text-xs font-medium text-slate-400">
            <TrendingUp className="h-3.5 w-3.5" />
            Progress
          </div>
          <div className="mt-2.5">
            <ProgressBar value={job.progress} />
          </div>
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border border-slate-200/70 shadow-sm shadow-slate-200/50">
        <div className="border-b border-slate-800 bg-slate-900 px-5 py-3">
          <h2 className="text-sm font-semibold text-slate-200">Log</h2>
        </div>
        <div ref={logRef} className="h-96 overflow-y-auto bg-slate-900 p-4 font-mono text-xs">
          {job.logs.length === 0 ? (
            <p className="text-slate-500">No log entries yet.</p>
          ) : (
            job.logs.map((entry, i) => (
              <div key={i} className={`py-0.5 ${LOG_LEVEL_STYLES[entry.level]}`}>
                <span className="text-slate-500">
                  {new Date(entry.timestamp).toLocaleTimeString()}
                </span>{" "}
                {entry.message}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
