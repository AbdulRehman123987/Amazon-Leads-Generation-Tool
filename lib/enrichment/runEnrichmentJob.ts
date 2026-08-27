import { prisma } from "@/lib/db";
import { findContactInfo, computeEnrichmentStatus, INTER_REQUEST_DELAY_MS } from "@/lib/enrichment/findContactInfo";
import { setJobStatus, setJobTotal, recordJobItem } from "@/lib/jobs";
import type { BrandEnrichmentInput } from "@/lib/types";
import type { Brand } from "@/lib/generated/prisma/client";

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function enrichBrand(jobId: string, brand: Brand): Promise<void> {
  const result = await findContactInfo(jobId, brand.displayName, brand.websiteUrl);

  await prisma.brand.update({
    where: { id: brand.id },
    data: {
      websiteUrl: result.websiteUrl,
      websiteConfidence: result.websiteConfidence,
      email: result.email,
      phone: result.phone,
      contactPageUrl: result.contactPageUrl,
      enrichmentStatus: computeEnrichmentStatus(result.websiteUrl, result.email),
      rawNotes: result.notes.join("\n"),
    },
  });
}

export async function runBrandEnrichmentJob(jobId: string): Promise<void> {
  const job = await prisma.scrapeJob.findUnique({ where: { id: jobId } });
  if (!job) return;

  const input = job.input as unknown as BrandEnrichmentInput;

  try {
    await setJobTotal(jobId, input.brandIds.length);
    await setJobStatus(jobId, "RUNNING", `Starting brand enrichment for ${input.brandIds.length} brand(s)`);

    for (const brandId of input.brandIds) {
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
