"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { RefreshCw } from "lucide-react";
import { useToast } from "@/components/Toast";
import { postJson } from "@/lib/apiClient";
import type { StartJobResponse } from "@/lib/types";

export function MetaAdRowEnrichButton({ id }: { id: string }) {
  const router = useRouter();
  const toast = useToast();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);

  async function handleClick() {
    setError(false);
    setLoading(true);
    try {
      const { jobId } = await postJson<StartJobResponse>("/api/scrape/meta-ads/enrich", {
        metaAdBrandIds: [id],
      });
      toast.info("Looking up contact info…");
      router.push(`/jobs/${jobId}`);
    } catch (err) {
      setError(true);
      setLoading(false);
      toast.error((err as Error).message);
    }
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={loading}
      title={error ? "Failed to start — try again" : "Find contact info"}
      className={`rounded p-1.5 transition-colors disabled:opacity-50 ${
        error ? "text-rose-500" : "text-slate-400 hover:bg-slate-100 hover:text-indigo-600"
      }`}
    >
      <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
    </button>
  );
}
