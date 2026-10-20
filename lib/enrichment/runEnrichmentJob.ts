import { prisma } from "@/lib/db";
import { findContactInfo, computeEnrichmentStatus, INTER_REQUEST_DELAY_MS } from "@/lib/enrichment/findContactInfo";
import { setJobStatus, setJobTotal, recordJobItem, appendJobLog, isJobCancelled } from "@/lib/jobs";
import type { BrandEnrichmentInput } from "@/lib/types";
import type { Brand } from "@/lib/generated/prisma/client";

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function enrichBrand(jobId: string, brand: Brand): Promise<void> {
  const result = await findContactInfo(jobId, brand.displayName, brand.websiteUrl);

  // A lookup that finds nothing must not wipe details that are already there —
  // someone may have filled them in by hand. New findings replace old ones.
  const websiteUrl = result.websiteUrl ?? brand.websiteUrl;
  const email = result.email ?? brand.email;

  await prisma.brand.update({
    where: { id: brand.id },
    data: {
      websiteUrl,
      websiteConfidence: result.websiteConfidence ?? brand.websiteConfidence,
      email,
      phone: result.phone ?? brand.phone,
      contactPageUrl: result.contactPageUrl ?? brand.contactPageUrl,
      enrichmentStatus: computeEnrichmentStatus(websiteUrl, email, result.incomplete),
      rawNotes: result.notes.join("\n"),
    },
  });
}

export async function runBrandEnrichmentJob(jobId: string): Promise<void> {
  const job = await prisma.scrapeJob.findUnique({ where: { id: jobId } });
  if (!job) return;

  const input = job.input as unknown as BrandEnrichmentInput;

  try {
    if (await isJobCancelled(jobId)) return; // stopped before it even started

    await setJobTotal(jobId, input.brandIds.length);
    await setJobStatus(jobId, "RUNNING", `Starting brand enrichment for ${input.brandIds.length} brand(s)`);

    for (const brandId of input.brandIds) {
      if (await isJobCancelled(jobId)) {
        await appendJobLog(jobId, "Stopped — brands not reached yet are left as they were", "warn");
        return;
      }

      const brand = await prisma.brand.findUnique({ where: { id: brandId } });
      if (!brand) {
        await recordJobItem(jobId, `Brand ${brandId} no longer exists — skipped`, { isError: true });
        continue;
      }

      await prisma.brand.update({ where: { id: brand.id }, data: { enrichmentStatus: "IN_PROGRESS" } });

      try {
        await enrichBrand(jobId, brand);
        const updated = await prisma.brand.findUniqueOrThrow({ where: { id: brand.id } });
        await recordJobItem(jobId, `Enriched "${brand.displayName}" — ${updated.enrichmentStatus}`);
      } catch (err) {
        await prisma.brand.update({ where: { id: brand.id }, data: { enrichmentStatus: "NOT_FOUND" } });
        await recordJobItem(jobId, `Failed to enrich "${brand.displayName}": ${(err as Error).message}`, {
          isError: true,
        });
      }

      await sleep(INTER_REQUEST_DELAY_MS);
    }

    await setJobStatus(jobId, "COMPLETED", `Job finished: ${input.brandIds.length} brand(s) processed`);
  } catch (err) {
    await setJobStatus(jobId, "FAILED", `Job failed: ${(err as Error).message}`);
  }
}
