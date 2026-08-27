"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Save, Sparkles } from "lucide-react";
import { Button } from "@/components/Button";
import { useToast } from "@/components/Toast";
import { patchJson, postJson } from "@/lib/apiClient";
import type { StartJobResponse, UpdateBrandRequest } from "@/lib/types";

const inputClass =
  "w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-mono text-slate-900 transition-colors focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-100";

export function BrandEditForm({
  brandId,
  initialWebsiteUrl,
  initialEmail,
  initialPhone,
}: {
  brandId: string;
  initialWebsiteUrl: string | null;
  initialEmail: string | null;
  initialPhone: string | null;
}) {
  const router = useRouter();
  const toast = useToast();
  const [websiteUrl, setWebsiteUrl] = useState(initialWebsiteUrl ?? "");
  const [email, setEmail] = useState(initialEmail ?? "");
  const [phone, setPhone] = useState(initialPhone ?? "");
  const [saving, setSaving] = useState(false);
  const [reEnriching, setReEnriching] = useState(false);

  async function handleSave() {
    setSaving(true);
    try {
      const body: UpdateBrandRequest = {
        websiteUrl: websiteUrl.trim() || null,
        email: email.trim() || null,
        phone: phone.trim() || null,
      };
      await patchJson(`/api/brands/${brandId}`, body);
      toast.success("Contact details saved.");
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
      <div className="mb-5 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-slate-900">Contact details</h2>
        <Button variant="secondary" onClick={handleReEnrich} disabled={reEnriching}>
          <Sparkles className="h-4 w-4" />
          {reEnriching ? "Starting…" : "Re-run enrichment"}
        </Button>
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
