import { CardGridSkeleton, FilterBarSkeleton, PageHeaderSkeleton, Skeleton } from "@/components/Skeleton";

export default function ProductsLoading() {
  return (
    <div className="flex flex-col gap-6">
      <PageHeaderSkeleton actions={1} />

      <div className="flex flex-wrap gap-2">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-7 w-24 rounded-full" />
        ))}
      </div>

      <FilterBarSkeleton />

      <Skeleton className="h-[52px] w-full rounded-2xl" />

      <CardGridSkeleton count={12} />
    </div>
  );
}
