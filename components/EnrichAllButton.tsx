"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Sparkles } from "lucide-react";
import { Button } from "@/components/Button";
import { useToast } from "@/components/Toast";
import { postJson } from "@/lib/apiClient";
import type { StartJobResponse } from "@/lib/types";

export function EnrichAllButton({ count, endpoint }: { count: number; endpoint: string }) {
  const router = useRouter();
  const toast = useToast();
  const [enriching, setEnriching] = useState(false);

  async function handleClick() {
    setEnriching(true);
    try {
      const { jobId } = await postJson<StartJobResponse>(endpoint, {
        mode: "needs-enrichment",
      });
      toast.success(`Enrichment started for ${count} brand${count === 1 ? "" : "s"}.`);
      router.push(`/jobs/${jobId}`);
    } catch (err) {
      toast.error((err as Error).message);
      setEnriching(false);
    }
  }

  return (
    <Button variant="primary" onClick={handleClick} disabled={count === 0 || enriching}>
      <Sparkles className="h-4 w-4" />
      {enriching ? "Starting…" : `Enrich pending brands (${count})`}
    </Button>
  );
}
