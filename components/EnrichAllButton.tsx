"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Sparkles } from "lucide-react";
import { Button } from "@/components/Button";
import { postJson } from "@/lib/apiClient";
import type { StartJobResponse } from "@/lib/types";

export function EnrichAllButton({ count, endpoint }: { count: number; endpoint: string }) {
  const router = useRouter();
  const [enriching, setEnriching] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleClick() {
    setError(null);
    setEnriching(true);
    try {
      const { jobId } = await postJson<StartJobResponse>(endpoint, {
        mode: "needs-enrichment",
      });
      router.push(`/jobs/${jobId}`);
    } catch (err) {
      setError((err as Error).message);
      setEnriching(false);
    }
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <Button variant="primary" onClick={handleClick} disabled={count === 0 || enriching}>
        <Sparkles className="h-4 w-4" />
        {enriching ? "Starting…" : `Enrich pending brands (${count})`}
      </Button>
      {error && <p className="text-xs text-rose-600">{error}</p>}
    </div>
  );
}
