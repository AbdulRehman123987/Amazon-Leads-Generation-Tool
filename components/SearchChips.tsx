import Link from "next/link";
import type { JobOption } from "@/lib/types";

export function SearchChips({
  jobs,
  activeJobId,
  buildHref,
}: {
  jobs: JobOption[];
  activeJobId: string;
  buildHref: (jobId: string) => string;
}) {
  if (jobs.length === 0) return null;

  const baseClass = "rounded-full px-3 py-1.5 text-xs font-medium transition-colors";
  const activeClass = "bg-indigo-600 text-white";
  const inactiveClass = "border border-slate-200 bg-white text-slate-600 hover:bg-slate-50";

  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-xs font-medium text-slate-400">Searches:</span>
      <Link href={buildHref("")} className={`${baseClass} ${!activeJobId ? activeClass : inactiveClass}`}>
        All
      </Link>
      {jobs.map((job) => (
        <Link
          key={job.id}
          href={buildHref(job.id)}
          className={`${baseClass} ${activeJobId === job.id ? activeClass : inactiveClass}`}
        >
          {job.label} · {job.productCount}
        </Link>
      ))}
    </div>
  );
}
