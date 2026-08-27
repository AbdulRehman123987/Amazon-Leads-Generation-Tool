// Soft-filled pill badges, one semantic color family per state:
// slate = idle/not started, indigo = active/running, emerald = success,
// amber = partial, rose = failed/not found.
const STYLES_BY_STATUS: Record<string, { pill: string; dot: string }> = {
  PENDING: { pill: "bg-slate-100 text-slate-600", dot: "bg-slate-400" },
  RUNNING: { pill: "bg-indigo-50 text-indigo-700", dot: "bg-indigo-500" },
  COMPLETED: { pill: "bg-emerald-50 text-emerald-700", dot: "bg-emerald-500" },
  FAILED: { pill: "bg-rose-50 text-rose-700", dot: "bg-rose-500" },
  NOT_STARTED: { pill: "bg-slate-100 text-slate-600", dot: "bg-slate-400" },
  IN_PROGRESS: { pill: "bg-indigo-50 text-indigo-700", dot: "bg-indigo-500" },
  FOUND: { pill: "bg-emerald-50 text-emerald-700", dot: "bg-emerald-500" },
  PARTIAL: { pill: "bg-amber-50 text-amber-700", dot: "bg-amber-500" },
  NOT_FOUND: { pill: "bg-rose-50 text-rose-700", dot: "bg-rose-500" },
};

export function StatusBadge({ status }: { status: string }) {
  const style = STYLES_BY_STATUS[status] ?? { pill: "bg-slate-100 text-slate-600", dot: "bg-slate-400" };
  const isActive = status === "RUNNING" || status === "IN_PROGRESS";

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${style.pill}`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${style.dot} ${isActive ? "animate-pulse" : ""}`} />
      {status.replace(/_/g, " ")}
    </span>
  );
}
