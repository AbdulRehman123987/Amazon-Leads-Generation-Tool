"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Eye, EyeOff, KeyRound, Save, Trash2 } from "lucide-react";
import { Button } from "@/components/Button";
import { useToast } from "@/components/Toast";
import { deleteJson, putJson } from "@/lib/apiClient";
import type { ApiKeyState, RemoveApiKeyRequest, SaveApiKeyRequest, SaveApiKeyResponse } from "@/lib/types";

const STATE_BADGES: Record<ApiKeyState, { text: (hint: string | null) => string; pill: string; dot: string }> = {
  own: { text: (hint) => `Using your key ${hint ?? ""}`.trim(), pill: "bg-emerald-50 text-emerald-700", dot: "bg-emerald-500" },
  shared: { text: () => "Using the team's shared key", pill: "bg-slate-100 text-slate-600", dot: "bg-slate-400" },
  required: { text: () => "Your own key is required", pill: "bg-rose-50 text-rose-700", dot: "bg-rose-500" },
  missing: { text: () => "No key set up yet", pill: "bg-amber-50 text-amber-700", dot: "bg-amber-500" },
  unreadable: {
    text: () => "The saved key can't be read — enter it again",
    pill: "bg-amber-50 text-amber-700",
    dot: "bg-amber-500",
  },
};

const inputClass =
  "w-full rounded-lg border border-slate-200 bg-white px-3 py-2 pr-10 text-sm font-mono text-slate-900 placeholder:font-sans placeholder:text-slate-400 transition-colors focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-100";

/** One service's key: shows where it stands, and lets the person add, replace or remove their own. */
export function ApiKeyForm({
  kind,
  label,
  description,
  state,
  hint,
  hasSaved,
}: {
  kind: string;
  label: string;
  description: string;
  state: ApiKeyState;
  hint: string | null;
  hasSaved: boolean;
}) {
  const router = useRouter();
  const toast = useToast();
  const [value, setValue] = useState("");
  const [show, setShow] = useState(false);
  const [saving, setSaving] = useState(false);
  const [removing, setRemoving] = useState(false);
  const badge = STATE_BADGES[state];

  async function handleSave(event: FormEvent) {
    event.preventDefault();
    if (!value.trim()) return;
    setSaving(true);
    try {
      const body: SaveApiKeyRequest = { kind, key: value.trim() };
      const saved = await putJson<SaveApiKeyResponse>("/api/settings/api-keys", body);
      if (!saved.verified) {
        toast.info(`Key saved, but ${label} couldn't be reached to check it just now.`);
      } else if (saved.creditsLeft === 0) {
        toast.info(`Key saved, but ${label} says it has no credits left.`);
      } else {
        toast.success(
          saved.creditsLeft != null
            ? `Key saved — ${saved.creditsLeft.toLocaleString()} credits left.`
            : "Key saved."
        );
      }
      setValue("");
      setShow(false);
      router.refresh();
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  async function handleRemove() {
    const after =
      state === "required" || state === "missing"
        ? ""
        : " Searches you start will use the team's shared key again (if there is one).";
    if (!window.confirm(`Remove your ${label} key?${after}`)) return;
    setRemoving(true);
    try {
      const body: RemoveApiKeyRequest = { kind };
      await deleteJson("/api/settings/api-keys", body);
      toast.success("Key removed.");
      router.refresh();
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setRemoving(false);
    }
  }

  return (
    <form
      onSubmit={handleSave}
      className="rounded-2xl border border-slate-200/70 bg-white p-6 shadow-sm shadow-slate-200/50"
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h2 className="flex items-center gap-1.5 text-sm font-semibold text-slate-900">
            <KeyRound className="h-4 w-4 text-slate-400" />
            {label} key
          </h2>
          <p className="mt-1 text-sm text-slate-500">{description}</p>
        </div>
        <span
          className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${badge.pill}`}
        >
          <span className={`h-1.5 w-1.5 rounded-full ${badge.dot}`} />
          {badge.text(hint)}
        </span>
      </div>

      <div className="mt-5 flex flex-col gap-1.5">
        <label className="text-sm font-medium text-slate-700" htmlFor={`key-${kind}`}>
          {hasSaved ? "Replace with a new key" : "Your key"}
        </label>
        <div className="relative">
          <input
            id={`key-${kind}`}
            type={show ? "text" : "password"}
            autoComplete="off"
            spellCheck={false}
            className={inputClass}
            placeholder={`Paste your ${label} API key`}
            value={value}
            onChange={(e) => setValue(e.target.value)}
          />
          <button
            type="button"
            onClick={() => setShow((current) => !current)}
            aria-label={show ? "Hide the key" : "Show the key"}
            className="absolute inset-y-0 right-0 flex w-10 items-center justify-center text-slate-400 hover:text-slate-600"
          >
            {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        </div>
        <p className="text-xs text-slate-400">
          It is checked with {label} when you save, stored encrypted, and only its last 4 characters are ever shown
          again.
        </p>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <Button type="submit" variant="primary" disabled={saving || !value.trim()}>
          <Save className="h-4 w-4" />
          {saving ? "Checking…" : hasSaved ? "Replace key" : "Save key"}
        </Button>
        {hasSaved && (
          <Button type="button" variant="danger" onClick={handleRemove} disabled={removing}>
            <Trash2 className="h-4 w-4" />
            {removing ? "Removing…" : "Remove key"}
          </Button>
        )}
      </div>
    </form>
  );
}
