import { FilterBarSkeleton, PageHeaderSkeleton, TableSkeleton } from "@/components/Skeleton";

export default function BrandsLoading() {
  return (
    <div className="flex flex-col gap-6">
      <PageHeaderSkeleton actions={2} />
      <FilterBarSkeleton />
      <TableSkeleton rows={10} cols={7} withAvatar />
    </div>
  );
}
