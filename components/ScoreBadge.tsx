// Score encodes how promising a lead is (see lib/scoring.ts) — color intensity
// mirrors that: rose = hot lead, amber = warm, slate = low priority.
function scoreTier(score: number): "hot" | "warm" | "cool" {
  if (score >= 0.7) return "hot";
  if (score >= 0.4) return "warm";
  return "cool";
}

const TIER_STYLES = {
  hot: "bg-rose-500 text-white",
  warm: "bg-amber-400 text-amber-950",
  cool: "bg-white text-slate-500 ring-1 ring-slate-200",
} as const;

export function ScoreBadge({ score }: { score: number | null }) {
  if (score == null) {
    return (
      <span className="inline-flex items-center rounded-full bg-white px-2 py-0.5 text-xs font-semibold text-slate-400 shadow-sm ring-1 ring-slate-200">
        —
      </span>
    );
  }

  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold tabular-nums shadow-sm ${TIER_STYLES[scoreTier(score)]}`}
    >
      {score.toFixed(2)}
    </span>
  );
}
