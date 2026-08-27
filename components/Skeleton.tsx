export function Skeleton({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse rounded-md bg-slate-200/70 ${className}`} />;
}

export function PageHeaderSkeleton({ actions = 1 }: { actions?: number }) {
  return (
    <div className="flex items-center justify-between">
      <div className="flex flex-col gap-2">
        <Skeleton className="h-7 w-48" />
        <Skeleton className="h-4 w-64" />
      </div>
      {actions > 0 && (
        <div className="flex items-center gap-3">
          {Array.from({ length: actions }).map((_, i) => (
            <Skeleton key={i} className="h-9 w-32 rounded-lg" />
          ))}
        </div>
      )}
    </div>
  );
}

export function FilterBarSkeleton() {
  return <Skeleton className="h-[68px] w-full rounded-2xl" />;
}

export function StatGridSkeleton({ count = 6 }: { count?: number }) {
  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className="rounded-2xl border border-slate-200/70 bg-white p-5 shadow-sm shadow-slate-200/50"
        >
          <Skeleton className="h-9 w-9 rounded-lg" />
          <Skeleton className="mt-3 h-7 w-12" />
          <Skeleton className="mt-2 h-3.5 w-20" />
        </div>
      ))}
    </div>
  );
}

const COL_WIDTHS = ["w-32", "w-20", "w-24", "w-16", "w-28", "w-20", "w-24"];

export function TableSkeleton({
  rows = 8,
  cols = 6,
  withAvatar = true,
}: {
  rows?: number;
  cols?: number;
  withAvatar?: boolean;
}) {
  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200/70 bg-white shadow-sm shadow-slate-200/50">
      <div className="border-b border-slate-100 px-6 py-3.5">
        <div className="flex gap-10">
          {Array.from({ length: cols }).map((_, i) => (
            <Skeleton key={i} className={`h-3 ${COL_WIDTHS[i % COL_WIDTHS.length]}`} />
          ))}
        </div>
      </div>
      <div className="divide-y divide-slate-100">
        {Array.from({ length: rows }).map((_, r) => (
          <div key={r} className="flex items-center gap-10 px-6 py-4">
            {Array.from({ length: cols }).map((_, c) =>
              c === 0 && withAvatar ? (
                <div key={c} className="flex items-center gap-2.5">
                  <Skeleton className="h-7 w-7 shrink-0 rounded-full" />
                  <Skeleton className={`h-3.5 ${COL_WIDTHS[(r + 1) % COL_WIDTHS.length]}`} />
                </div>
              ) : (
                <Skeleton key={c} className={`h-3.5 ${COL_WIDTHS[(r + c) % COL_WIDTHS.length]}`} />
              )
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

export function CardGridSkeleton({ count = 12 }: { count?: number }) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className="flex flex-col overflow-hidden rounded-2xl border border-slate-200/70 bg-white shadow-sm shadow-slate-200/50"
        >
          <Skeleton className="aspect-square w-full rounded-none" />
          <div className="flex flex-col gap-2.5 p-4">
            <Skeleton className="h-3.5 w-full" />
            <Skeleton className="h-3.5 w-2/3" />
            <div className="mt-1 flex items-center justify-between">
              <Skeleton className="h-4 w-12" />
              <Skeleton className="h-4 w-16" />
            </div>
            <div className="mt-2 flex items-center justify-between border-t border-slate-100 pt-3">
              <Skeleton className="h-4 w-24" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
