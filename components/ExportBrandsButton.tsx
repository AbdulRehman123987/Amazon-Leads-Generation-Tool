"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Download } from "lucide-react";
import { Button } from "@/components/Button";
import { useToast } from "@/components/Toast";
import type { ExportBrandsRequest } from "@/lib/types";

interface ExportBrandsButtonProps {
  q: string;
  status: string;
  /** Exportable brands (Found/Partial) not exported before, for the current search/status. */
  newCount: number;
  /** Exportable brands including ones already exported. */
  allCount: number;
}

export function ExportBrandsButton({ q, status, newCount, allCount }: ExportBrandsButtonProps) {
  const router = useRouter();
  const toast = useToast();
  const [skipExported, setSkipExported] = useState(true);
  const [exporting, setExporting] = useState(false);

  const count = skipExported ? newCount : allCount;
  const alreadyExported = allCount - newCount;

  let title = `Exports ${count} brand${count === 1 ? "" : "s"} with a Found or Partial result`;
  if (count === 0) {
    title =
      skipExported && alreadyExported > 0
        ? "Everything with a result was already exported. Untick \"Skip already exported\" to export it again."
        : "Nothing to export. Only brands with a Found or Partial result are exported.";
  }

  async function handleExport() {
    setExporting(true);
    try {
      const body: ExportBrandsRequest = { q, status, includeExported: !skipExported };
      const res = await fetch("/api/export/brands", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const data: unknown = await res.json().catch(() => null);
        throw new Error(
          data && typeof data === "object" && "error" in data
            ? String((data as { error: unknown }).error)
            : `Export failed (${res.status})`
        );
      }

      const exported = Number(res.headers.get("X-Export-Count") ?? 0);
      if (exported === 0) {
        toast.info("No brands to export.");
        router.refresh();
        return;
      }

      const filename =
        /filename="([^"]+)"/.exec(res.headers.get("Content-Disposition") ?? "")?.[1] ?? "brands.csv";
      const url = URL.createObjectURL(await res.blob());
      const link = document.createElement("a");
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);

      toast.success(`Exported ${exported} brand${exported === 1 ? "" : "s"}.`);
      router.refresh();
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setExporting(false);
    }
  }

  return (
    <div className="flex items-center gap-3">
      <label className="flex cursor-pointer select-none items-center gap-1.5 text-xs text-slate-500">
        <input
          type="checkbox"
          checked={skipExported}
          onChange={(e) => setSkipExported(e.target.checked)}
          className="h-3.5 w-3.5 rounded border-slate-300 accent-indigo-600"
        />
        Skip already exported{alreadyExported > 0 ? ` (${alreadyExported})` : ""}
      </label>
      <Button onClick={handleExport} disabled={count === 0 || exporting} title={title}>
        <Download className="h-4 w-4" />
        {exporting ? "Exporting…" : `Export CSV (${count})`}
      </Button>
    </div>
  );
}
