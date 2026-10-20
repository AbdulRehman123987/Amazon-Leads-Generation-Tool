import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { requirePageUser } from "@/lib/auth/currentUser";
import { isAdmin, ownedBy } from "@/lib/auth/access";
import { toJobDetail } from "@/lib/jobs";
import { JobLiveView } from "@/components/JobLiveView";

export const dynamic = "force-dynamic";

export default async function JobDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await requirePageUser();
  const { id } = await params;
  // Someone else's job looks exactly like one that doesn't exist.
  const job = await prisma.scrapeJob.findFirst({
    where: { id, ...ownedBy(user) },
    include: {
      _count: { select: { products: true, metaAdBrands: true } },
      user: { select: { email: true } },
    },
  });
  if (!job) notFound();

  const resultCount =
    job.type === "META_ADS_SEARCH" ? job._count.metaAdBrands : job._count.products;

  return (
    <JobLiveView
      initialJob={toJobDetail(job)}
      resultCount={resultCount}
      ownerEmail={isAdmin(user) ? (job.user?.email ?? null) : undefined}
    />
  );
}
