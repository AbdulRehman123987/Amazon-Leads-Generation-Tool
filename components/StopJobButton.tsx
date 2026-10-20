"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Square } from "lucide-react";
import { Button } from "@/components/Button";
import { useToast } from "@/components/Toast";
import { postJson } from "@/lib/apiClient";

/**
 * For a scrape started by mistake (or one stuck on "running"). The job finishes
 * the item it is on, then stops; everything it found so far is kept.
 */
export function StopJobButton({
  jobId,
  compact = false,
  onDone,
}: {
  jobId: string;
  /** Small text button for table rows instead of the full-size one. */
  compact?: boolean;
  /** Runs once the request is over (stopped, or it had already finished). */
  onDone?: () => void;
}) {
  const router = useRouter();
  const toast = useToast();
  const [stopping, setStopping] = useState(false);

  async function handleStop() {
    if (!window.confirm("Stop this job? Anything it has already found is kept.")) return;
    setStopping(true);
    try {
      await postJson(`/api/jobs/${jobId}/cancel`, {});
      toast.success("Job stopped.");
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setStopping(false);
      router.refresh();
      onDone?.();
    }
  }

  if (compact) {
    return (
      <button
        type="button"
        onClick={handleStop}
        disabled={stopping}
        className="inline-flex items-center gap-1 text-xs font-medium text-rose-600 hover:text-rose-700 disabled:opacity-50"
      >
        <Square className="h-3 w-3 fill-current" />
        {stopping ? "Stopping…" : "Stop"}
      </button>
    );
  }

  return (
    <Button variant="danger" onClick={handleStop} disabled={stopping}>
      <Square className="h-3.5 w-3.5 fill-current" />
      {stopping ? "Stopping…" : "Stop job"}
    </Button>
  );
}
