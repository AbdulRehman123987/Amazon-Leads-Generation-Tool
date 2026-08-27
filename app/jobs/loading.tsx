import { FilterBarSkeleton, PageHeaderSkeleton, TableSkeleton } from "@/components/Skeleton";

export default function JobsLoading() {
  return (
    <div className="flex flex-col gap-6">
      <PageHeaderSkeleton actions={0} />
      <FilterBarSkeleton />
      <TableSkeleton rows={10} cols={6} withAvatar={false} />
    </div>
  );
}
