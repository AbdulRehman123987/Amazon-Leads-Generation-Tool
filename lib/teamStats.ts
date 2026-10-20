// Per-person activity for the admin dashboard. Only ever call this for an admin:
// it deliberately looks across everyone's rows, so it does not take `ownedBy`.
import { prisma } from "@/lib/db";
import type { UserRole } from "@/lib/generated/prisma/client";

export interface TeamMemberStats {
  /** null: rows left behind by a deleted account (only an admin can see them). */
  userId: string | null;
  email: string | null;
  role: UserRole | null;
  amazonSearches: number;
  adLibrarySearches: number;
  /** Jobs pending or running right now. */
  activeJobs: number;
  /** When they last started any job. */
  lastActiveAt: Date | null;
  products: number;
  brands: number;
  found: number;
  partial: number;
  notFound: number;
  /** Not looked up yet, or being looked up right now. */
  pending: number;
  /** Brands that have an email address. */
  withEmail: number;
  /** Brands that went out in a CSV export. */
  exported: number;
  adLibraryBrands: number;
  /** Ad Library brands whose lookup found a website and/or an email. */
  adLibraryWithContact: number;
  /** Whether they saved their own scrape.do / SearchAPI.io key (the keys themselves never leave the server). */
  hasScrapeDoKey: boolean;
  hasSearchApiKey: boolean;
}

function blank(userId: string | null): TeamMemberStats {
  return {
    userId,
    email: null,
    role: null,
    amazonSearches: 0,
    adLibrarySearches: 0,
    activeJobs: 0,
    lastActiveAt: null,
    products: 0,
    brands: 0,
    found: 0,
    partial: 0,
    notFound: 0,
    pending: 0,
    withEmail: 0,
    exported: 0,
    adLibraryBrands: 0,
    adLibraryWithContact: 0,
    hasScrapeDoKey: false,
    hasSearchApiKey: false,
  };
}

export async function getTeamStats(): Promise<TeamMemberStats[]> {
  const [
    users,
    jobsByType,
    activeJobs,
    lastJob,
    productCounts,
    brandsByStatus,
    brandsWithEmail,
    brandsExported,
    adBrandsByStatus,
  ] = await Promise.all([
    prisma.user.findMany({
      select: { id: true, email: true, role: true, scrapeDoApiKey: true, searchApiKey: true },
      orderBy: { createdAt: "asc" },
    }),
    prisma.scrapeJob.groupBy({ by: ["userId", "type"], _count: { _all: true } }),
    prisma.scrapeJob.groupBy({
      by: ["userId"],
      where: { status: { in: ["PENDING", "RUNNING"] } },
      _count: { _all: true },
    }),
    prisma.scrapeJob.groupBy({ by: ["userId"], _max: { createdAt: true } }),
    prisma.product.groupBy({ by: ["userId"], _count: { _all: true } }),
    prisma.brand.groupBy({ by: ["userId", "enrichmentStatus"], _count: { _all: true } }),
    prisma.brand.groupBy({ by: ["userId"], where: { email: { not: null } }, _count: { _all: true } }),
    prisma.brand.groupBy({ by: ["userId"], where: { exportedAt: { not: null } }, _count: { _all: true } }),
    prisma.metaAdBrand.groupBy({ by: ["userId", "enrichmentStatus"], _count: { _all: true } }),
  ]);

  const byUser = new Map<string | null, TeamMemberStats>();
  const row = (userId: string | null) => {
    let stats = byUser.get(userId);
    if (!stats) {
      stats = blank(userId);
      byUser.set(userId, stats);
    }
    return stats;
  };

  // Everyone gets a row, even someone who hasn't done anything yet.
  for (const user of users) {
    const stats = row(user.id);
    stats.email = user.email;
    stats.role = user.role;
    // Only whether a key is saved — never the (encrypted) key itself.
    stats.hasScrapeDoKey = Boolean(user.scrapeDoApiKey);
    stats.hasSearchApiKey = Boolean(user.searchApiKey);
  }
  for (const group of jobsByType) {
    const stats = row(group.userId);
    if (group.type === "AMAZON_SEARCH") stats.amazonSearches += group._count._all;
    if (group.type === "META_ADS_SEARCH") stats.adLibrarySearches += group._count._all;
  }
  for (const group of activeJobs) row(group.userId).activeJobs += group._count._all;
  for (const group of lastJob) row(group.userId).lastActiveAt = group._max.createdAt;
  for (const group of productCounts) row(group.userId).products += group._count._all;
  for (const group of brandsByStatus) {
    const stats = row(group.userId);
    const count = group._count._all;
    stats.brands += count;
    if (group.enrichmentStatus === "FOUND") stats.found += count;
    else if (group.enrichmentStatus === "PARTIAL") stats.partial += count;
    else if (group.enrichmentStatus === "NOT_FOUND") stats.notFound += count;
    else stats.pending += count;
  }
  for (const group of brandsWithEmail) row(group.userId).withEmail += group._count._all;
  for (const group of brandsExported) row(group.userId).exported += group._count._all;
  for (const group of adBrandsByStatus) {
    const stats = row(group.userId);
    const count = group._count._all;
    stats.adLibraryBrands += count;
    if (group.enrichmentStatus === "FOUND" || group.enrichmentStatus === "PARTIAL") {
      stats.adLibraryWithContact += count;
    }
  }

  // Most searches first; the row for deleted accounts (if any) goes last.
  return [...byUser.values()].sort((a, b) => {
    if ((a.userId === null) !== (b.userId === null)) return a.userId === null ? 1 : -1;
    const searches = (s: TeamMemberStats) => s.amazonSearches + s.adLibrarySearches;
    return searches(b) - searches(a) || (a.email ?? "").localeCompare(b.email ?? "");
  });
}
