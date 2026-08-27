import { Skeleton } from "@/components/Skeleton";

export default function BrandDetailLoading() {
  return (
    <div className="flex max-w-3xl flex-col gap-6">
      <Skeleton className="h-4 w-20" />

      <div className="flex items-center gap-4">
        <Skeleton className="h-14 w-14 shrink-0 rounded-2xl" />
        <div className="flex flex-col gap-2">
          <Skeleton className="h-6 w-40" />
          <Skeleton className="h-5 w-24 rounded-full" />
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200/70 bg-white p-6 shadow-sm shadow-slate-200/50">
        <div className="mb-5 flex items-center justify-between">
          <Skeleton className="h-4 w-28" />
          <Skeleton className="h-9 w-36 rounded-lg" />
        </div>
        <div className="flex flex-col gap-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="flex flex-col gap-1.5">
              <Skeleton className="h-3.5 w-16" />
              <Skeleton className="h-9 w-full rounded-lg" />
            </div>
          ))}
          <Skeleton className="h-9 w-20 rounded-lg" />
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200/70 bg-white p-6 shadow-sm shadow-slate-200/50">
        <Skeleton className="mb-3 h-4 w-40" />
        <Skeleton className="h-20 w-full rounded-xl" />
      </div>

      <div className="rounded-2xl border border-slate-200/70 bg-white shadow-sm shadow-slate-200/50">
        <div className="border-b border-slate-100 px-6 py-4">
          <Skeleton className="h-4 w-36" />
        </div>
        <div className="divide-y divide-slate-100">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="flex items-center gap-8 px-6 py-3.5">
              <Skeleton className="h-3.5 w-48" />
              <Skeleton className="h-3.5 w-16" />
              <Skeleton className="h-5 w-14 rounded-full" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
