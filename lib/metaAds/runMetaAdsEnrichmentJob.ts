import { prisma } from "@/lib/db";
import { findContactInfo, computeEnrichmentStatus, INTER_REQUEST_DELAY_MS } from "@/lib/enrichment/findContactInfo";
import { setJobStatus, setJobTotal, recordJobItem } from "@/lib/jobs";
import type { MetaAdBrand } from "@/lib/generated/prisma/client";
import type { MetaAdsEnrichmentInput } from "@/lib/types";

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function enrichMetaAdBrand(jobId: string, brand: MetaAdBrand): Promise<void> {
  const result = await findContactInfo(jobId, brand.pageName, brand.websiteUrl);

  await prisma.metaAdBrand.update({
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

export async function runMetaAdsEnrichmentJob(jobId: string): Promise<void> {
  const job = await prisma.scrapeJob.findUnique({ where: { id: jobId } });
  if (!job) return;

  const input = job.input as unknown as MetaAdsEnrichmentInput;

  try {
    await setJobTotal(jobId, input.metaAdBrandIds.length);
    await setJobStatus(
      jobId,
      "RUNNING",
      `Starting contact enrichment for ${input.metaAdBrandIds.length} Ad Library brand(s)`
    );

    for (const metaAdBrandId of input.metaAdBrandIds) {
      const brand = await prisma.metaAdBrand.findUnique({ where: { id: metaAdBrandId } });
      if (!brand) {
        await recordJobItem(jobId, `Ad Library brand ${metaAdBrandId} no longer exists — skipped`, {
          isError: true,
        });
        continue;
      }

      await prisma.metaAdBrand.update({ where: { id: brand.id }, data: { enrichmentStatus: "IN_PROGRESS" } });

      try {
        await enrichMetaAdBrand(jobId, brand);
        const updated = await prisma.metaAdBrand.findUniqueOrThrow({ where: { id: brand.id } });
        await recordJobItem(jobId, `Enriched "${brand.pageName}" — ${updated.enrichmentStatus}`);
      } catch (err) {
        await prisma.metaAdBrand.update({ where: { id: brand.id }, data: { enrichmentStatus: "NOT_FOUND" } });
        await recordJobItem(jobId, `Failed to enrich "${brand.pageName}": ${(err as Error).message}`, {
          isError: true,
        });
      }

      await sleep(INTER_REQUEST_DELAY_MS);
    }

    await setJobStatus(
      jobId,
      "COMPLETED",
      `Job finished: ${input.metaAdBrandIds.length} Ad Library brand(s) processed`
    );
  } catch (err) {
    await setJobStatus(jobId, "FAILED", `Job failed: ${(err as Error).message}`);
  }
}
