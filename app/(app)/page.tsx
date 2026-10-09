import Link from "next/link";
import { Package, Building2, CheckCircle2, Mail, Activity, Megaphone, Plus } from "lucide-react";
import { prisma } from "@/lib/db";
import { summarizeJobInput } from "@/lib/jobSummary";
import { Button } from "@/components/Button";
import { StatusBadge } from "@/components/StatusBadge";
import { ProgressBar } from "@/components/ProgressBar";

export const dynamic = "force-dynamic";

const STAT_STYLES = {
  indigo: "bg-indigo-50 text-indigo-600",
  violet: "bg-violet-50 text-violet-600",
  emerald: "bg-emerald-50 text-emerald-600",
  amber: "bg-amber-50 text-amber-600",
  rose: "bg-rose-50 text-rose-600",
} as const;

function StatCard({
  label,
  value,
  icon: Icon,
  tint,
}: {
  label: string;
  value: number;
  icon: typeof Package;
  tint: keyof typeof STAT_STYLES;
}) {
  return (
    <div className="rounded-2xl border border-slate-200/70 bg-white p-5 shadow-sm shadow-slate-200/50 transition-shadow hover:shadow-md">
      <div className={`inline-flex h-9 w-9 items-center justify-center rounded-lg ${STAT_STYLES[tint]}`}>
        <Icon className="h-[18px] w-[18px]" />
      </div>
      <div className="mt-3 text-2xl font-semibold tracking-tight text-slate-900 tabular-nums">
        {value}
      </div>
      <div className="text-sm text-slate-500">{label}</div>
    </div>
  );
}

export default async function DashboardPage() {
  const [totalProducts, totalBrands, brandsEnriched, emailsFound, adLibraryBrands, jobsRunning, recentJobs] =
    await Promise.all([
      prisma.product.count(),
      prisma.brand.count(),
      prisma.brand.count({ where: { enrichmentStatus: { not: "NOT_STARTED" } } }),
      prisma.brand.count({ where: { email: { not: null } } }),
      prisma.metaAdBrand.count(),
      prisma.scrapeJob.count({ where: { status: "RUNNING" } }),
      prisma.scrapeJob.findMany({ orderBy: { createdAt: "desc" }, take: 10 }),
    ]);

  return (
    <div className="flex flex-col gap-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Dashboard</h1>
          <p className="mt-1 text-sm text-slate-500">
            Amazon leads for ReviewBoost outreach, at a glance.
          </p>
        </div>
        <Link href="/scrape/new">
          <Button variant="primary">
            <Plus className="h-4 w-4" />
            New Scrape
          </Button>
        </Link>
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
        <StatCard label="Products scraped" value={totalProducts} icon={Package} tint="indigo" />
        <StatCard label="Brands" value={totalBrands} icon={Building2} tint="violet" />
        <StatCard label="Brands enriched" value={brandsEnriched} icon={CheckCircle2} tint="emerald" />
        <StatCard label="Emails found" value={emailsFound} icon={Mail} tint="amber" />
        <StatCard label="Ad Library brands" value={adLibraryBrands} icon={Megaphone} tint="violet" />
        <StatCard label="Jobs running" value={jobsRunning} icon={Activity} tint="rose" />
      </div>

      <div className="rounded-2xl border border-slate-200/70 bg-white shadow-sm shadow-slate-200/50">
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
          <h2 className="text-sm font-semibold text-slate-900">Recent jobs</h2>
          <Link href="/jobs" className="text-xs font-medium text-indigo-600 hover:underline">
            View all →
          </Link>
        </div>
        {recentJobs.length === 0 ? (
          <p className="px-6 py-8 text-center text-sm text-slate-500">
            No jobs yet — start a scrape.
          </p>
        ) : (
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="text-left text-xs font-medium text-slate-400">
                <th className="px-6 py-2.5 font-medium">Type</th>
                <th className="px-6 py-2.5 font-medium">Status</th>
                <th className="px-6 py-2.5 font-medium">Progress</th>
                <th className="px-6 py-2.5 font-medium">Started</th>
                <th className="px-6 py-2.5 font-medium">Finished</th>
              </tr>
            </thead>
            <tbody>
              {recentJobs.map((job) => (
                <tr key={job.id} className="border-t border-slate-100 hover:bg-slate-50/70">
                  <td className="px-6 py-3">
                    <Link
                      href={`/jobs/${job.id}`}
                      className="font-medium text-indigo-600 hover:text-indigo-700 hover:underline"
                    >
                      {summarizeJobInput(job)}
                    </Link>
                  </td>
                  <td className="px-6 py-3">
                    <StatusBadge status={job.status} />
                  </td>
                  <td className="px-6 py-3">
                    <div className="flex items-center gap-2">
                      <div className="w-24">
                        <ProgressBar value={job.progress} />
                      </div>
                      <span className="text-xs text-slate-500 tabular-nums">
                        {job.processedItems}/{job.totalItems}
                      </span>
                    </div>
                  </td>
                  <td className="px-6 py-3 text-slate-500">{job.createdAt.toLocaleString()}</td>
                  <td className="px-6 py-3 text-slate-500">
                    {job.status === "COMPLETED" || job.status === "FAILED"
                      ? job.updatedAt.toLocaleString()
                      : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
