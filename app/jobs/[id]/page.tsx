import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { toJobDetail } from "@/lib/jobs";
import { JobLiveView } from "@/components/JobLiveView";

export const dynamic = "force-dynamic";

export default async function JobDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const job = await prisma.scrapeJob.findUnique({
    where: { id },
    include: { _count: { select: { products: true, metaAdBrands: true } } },
  });
  if (!job) notFound();

  const resultCount =
    job.type === "META_ADS_SEARCH" ? job._count.metaAdBrands : job._count.products;

  return <JobLiveView initialJob={toJobDetail(job)} resultCount={resultCount} />;
}
