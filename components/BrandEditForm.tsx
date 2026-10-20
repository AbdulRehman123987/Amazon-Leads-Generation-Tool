"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ExternalLink, Save, Sparkles } from "lucide-react";
import { Button } from "@/components/Button";
import { useToast } from "@/components/Toast";
import { patchJson, postJson } from "@/lib/apiClient";
import { MANUAL_BRAND_STATUSES, MANUAL_STATUS_HINTS } from "@/lib/brandStatus";
import type { StartJobResponse, UpdateBrandRequest } from "@/lib/types";

const inputClass =
  "w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-mono text-slate-900 transition-colors focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-100";

interface SavedBrand {
  enrichmentStatus: string;
  websiteUrl: string | null;
  email: string | null;
  phone: string | null;
}

function statusLabel(status: string) {
  const text = status.replace(/_/g, " ").toLowerCase();
  return text.charAt(0).toUpperCase() + text.slice(1);
}

function statusHint(status: string) {
  return (MANUAL_STATUS_HINTS as Record<string, string | undefined>)[status] ?? "Enrichment is running";
}

export function BrandEditForm({
  brandId,
  brandName,
  initialWebsiteUrl,
  initialEmail,
  initialPhone,
  initialStatus,
}: {
  brandId: string;
  brandName: string;
  initialWebsiteUrl: string | null;
  initialEmail: string | null;
  initialPhone: string | null;
  initialStatus: string;
}) {
  const router = useRouter();
  const toast = useToast();
  const [websiteUrl, setWebsiteUrl] = useState(initialWebsiteUrl ?? "");
  const [email, setEmail] = useState(initialEmail ?? "");
  const [phone, setPhone] = useState(initialPhone ?? "");
  const [status, setStatus] = useState(initialStatus);
  // What is stored, so only a status the person actually picked gets sent.
  const [savedStatus, setSavedStatus] = useState(initialStatus);
  const [saving, setSaving] = useState(false);
  const [reEnriching, setReEnriching] = useState(false);

  // IN_PROGRESS (enrichment running) isn't something to pick, but it has to show while it's current.
  const statusOptions: string[] = [...MANUAL_BRAND_STATUSES];
  if (!statusOptions.includes(status)) statusOptions.unshift(status);

  async function handleSave() {
    setSaving(true);
    try {
      const body: UpdateBrandRequest = {
        websiteUrl: websiteUrl.trim() || null,
        email: email.trim() || null,
        phone: phone.trim() || null,
        // Left out, the server sets it from what was found: website + email = Found, one of them = Partial.
        ...(status !== savedStatus ? { enrichmentStatus: status } : {}),
      };
      const saved = await patchJson<SavedBrand>(`/api/brands/${brandId}`, body);
      // The server tidies what was typed (e.g. adds https://) and may have changed the status.
      setWebsiteUrl(saved.websiteUrl ?? "");
      setEmail(saved.email ?? "");
      setPhone(saved.phone ?? "");
      setStatus(saved.enrichmentStatus);
      setSavedStatus(saved.enrichmentStatus);
      toast.success("Saved.");
      router.refresh();
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  async function handleReEnrich() {
    setReEnriching(true);
    try {
      const { jobId } = await postJson<StartJobResponse>("/api/scrape/enrich", {
        brandIds: [brandId],
      });
      toast.info("Enrichment started — watching for results.");
      router.push(`/jobs/${jobId}`);
    } catch (err) {
      toast.error((err as Error).message);
      setReEnriching(false);
    }
  }

  return (
    <div className="rounded-2xl border border-slate-200/70 bg-white p-6 shadow-sm shadow-slate-200/50">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-sm font-semibold text-slate-900">Contact details</h2>
        <div className="flex flex-wrap items-center gap-2">
          <a
            href={`https://www.google.com/search?q=${encodeURIComponent(`${brandName} official website contact email`)}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-sm font-medium text-slate-700 shadow-sm transition-colors hover:border-slate-300 hover:bg-slate-50"
          >
            <ExternalLink className="h-4 w-4" />
            Search on Google
          </a>
          <Button variant="secondary" onClick={handleReEnrich} disabled={reEnriching}>
            <Sparkles className="h-4 w-4" />
            {reEnriching ? "Starting…" : "Re-run enrichment"}
          </Button>
        </div>
      </div>

      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-slate-700" htmlFor="websiteUrl">
            Website
          </label>
          <input
            id="websiteUrl"
            className={inputClass}
            value={websiteUrl}
            onChange={(e) => setWebsiteUrl(e.target.value)}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-slate-700" htmlFor="email">
            Email
          </label>
          <input
            id="email"
            className={inputClass}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-slate-700" htmlFor="phone">
            Phone
          </label>
          <input
            id="phone"
            className={inputClass}
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-slate-700" htmlFor="enrichmentStatus">
            Status
          </label>
          <select
            id="enrichmentStatus"
            className={`${inputClass} font-sans`}
            value={status}
            onChange={(e) => setStatus(e.target.value)}
          >
            {statusOptions.map((option) => (
              <option key={option} value={option}>
                {statusLabel(option)} — {statusHint(option)}
              </option>
            ))}
          </select>
          <p className="text-xs text-slate-400">
            Researched it yourself? Enter what you found and save — the status follows (website + email = Found,
            one of them = Partial). Pick one here to set it yourself, e.g. Not found when you searched and
            found nothing. Only Found and Partial brands are included in the Brands export.
          </p>
        </div>

        <div>
          <Button variant="primary" onClick={handleSave} disabled={saving}>
            <Save className="h-4 w-4" />
            {saving ? "Saving…" : "Save"}
          </Button>
        </div>
      </div>
    </div>
  );
}
