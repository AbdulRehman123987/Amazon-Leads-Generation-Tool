import { Skeleton } from "@/components/Skeleton";

const LOG_LINE_WIDTHS = ["w-3/4", "w-1/2", "w-5/6", "w-2/3", "w-4/5", "w-1/2", "w-3/5", "w-2/3"];

export default function JobDetailLoading() {
  return (
    <div className="flex flex-col gap-6">
      <Skeleton className="h-4 w-16" />

      <div className="flex items-start justify-between">
        <div className="flex flex-col gap-2">
          <Skeleton className="h-3 w-28" />
          <Skeleton className="h-7 w-56" />
          <Skeleton className="h-3.5 w-40" />
        </div>
        <Skeleton className="h-9 w-44 rounded-lg" />
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            className="rounded-2xl border border-slate-200/70 bg-white p-4 shadow-sm shadow-slate-200/50"
          >
            <Skeleton className="h-3 w-16" />
            <Skeleton className="mt-2.5 h-6 w-20" />
          </div>
        ))}
      </div>

      <div className="overflow-hidden rounded-2xl border border-slate-200/70 shadow-sm shadow-slate-200/50">
        <div className="border-b border-slate-800 bg-slate-900 px-5 py-3">
          <div className="h-4 w-16 animate-pulse rounded bg-slate-700" />
        </div>
        <div className="flex h-96 flex-col gap-2 bg-slate-900 p-4">
          {LOG_LINE_WIDTHS.map((width, i) => (
            <div key={i} className={`h-3 animate-pulse rounded bg-slate-800 ${width}`} />
          ))}
        </div>
      </div>
    </div>
  );
}
