import { FilterBarSkeleton, PageHeaderSkeleton, Skeleton, TableSkeleton } from "@/components/Skeleton";

export default function AdLibraryLoading() {
  return (
    <div className="flex flex-col gap-6">
      <PageHeaderSkeleton actions={2} />

      <div className="flex flex-wrap gap-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-7 w-24 rounded-full" />
        ))}
      </div>

      <div className="flex flex-wrap items-end justify-between gap-3">
        <FilterBarSkeleton />
      </div>

      <TableSkeleton rows={10} cols={8} withAvatar />
    </div>
  );
}
