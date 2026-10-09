import { PageHeaderSkeleton, StatGridSkeleton, TableSkeleton } from "@/components/Skeleton";

export default function DashboardLoading() {
  return (
    <div className="flex flex-col gap-8">
      <PageHeaderSkeleton actions={1} />
      <StatGridSkeleton count={6} />
      <TableSkeleton rows={6} cols={5} withAvatar={false} />
    </div>
  );
}
