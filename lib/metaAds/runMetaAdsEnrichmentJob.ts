import { prisma } from "@/lib/db";
import { findContactInfo, computeEnrichmentStatus, INTER_REQUEST_DELAY_MS } from "@/lib/enrichment/findContactInfo";
import { setJobStatus, setJobTotal, recordJobItem, appendJobLog, isJobCancelled } from "@/lib/jobs";
import { ScrapeDoKeyError } from "@/lib/scrapeDo";
import { jobFailureMessage, keySourceNote, resolveApiKey, type KeySource } from "@/lib/apiKeys";
import type { MetaAdBrand } from "@/lib/generated/prisma/client";
import type { MetaAdsEnrichmentInput } from "@/lib/types";

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function enrichMetaAdBrand(jobId: string, brand: MetaAdBrand, apiKey: string): Promise<void> {
  const result = await findContactInfo(jobId, brand.pageName, brand.websiteUrl, apiKey);

  // A lookup that finds nothing must not wipe details that are already there.
  const websiteUrl = result.websiteUrl ?? brand.websiteUrl;
  const email = result.email ?? brand.email;

  await prisma.metaAdBrand.update({
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

/**
 * The contact lookup behind Ad Library brands uses scrape.do (not SearchAPI.io),
 * on the job owner's own key when they saved one. See runBrandEnrichmentJob.
 */
export async function runMetaAdsEnrichmentJob(jobId: string): Promise<void> {
  const job = await prisma.scrapeJob.findUnique({ where: { id: jobId } });
  if (!job) return;

  const input = job.input as unknown as MetaAdsEnrichmentInput;
  let keySource: KeySource = "shared";

  try {
    if (await isJobCancelled(jobId)) return; // stopped before it even started

    const resolved = await resolveApiKey("scrapeDo", job.userId);
    const apiKey = resolved.key;
    keySource = resolved.source;

    await setJobTotal(jobId, input.metaAdBrandIds.length);
    await setJobStatus(
      jobId,
      "RUNNING",
      `Starting contact enrichment for ${input.metaAdBrandIds.length} Ad Library brand(s)`
    );
    await appendJobLog(jobId, keySourceNote("scrapeDo", keySource));

    for (const metaAdBrandId of input.metaAdBrandIds) {
      if (await isJobCancelled(jobId)) {
        await appendJobLog(jobId, "Stopped — brands not reached yet are left as they were", "warn");
        return;
      }

      const brand = await prisma.metaAdBrand.findUnique({ where: { id: metaAdBrandId } });
      if (!brand) {
        await recordJobItem(jobId, `Ad Library brand ${metaAdBrandId} no longer exists — skipped`, {
          isError: true,
        });
        continue;
      }

      await prisma.metaAdBrand.update({ where: { id: brand.id }, data: { enrichmentStatus: "IN_PROGRESS" } });

      try {
        await enrichMetaAdBrand(jobId, brand, apiKey);
        const updated = await prisma.metaAdBrand.findUniqueOrThrow({ where: { id: brand.id } });
        await recordJobItem(jobId, `Enriched "${brand.pageName}" — ${updated.enrichmentStatus}`);
      } catch (err) {
        if (err instanceof ScrapeDoKeyError) {
          // The lookup never ran: put the brand back as it was, then stop the job.
          await prisma.metaAdBrand.update({
            where: { id: brand.id },
            data: { enrichmentStatus: brand.enrichmentStatus === "IN_PROGRESS" ? "NOT_STARTED" : brand.enrichmentStatus },
          });
          throw err;
        }
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
    await setJobStatus(jobId, "FAILED", `Job failed: ${jobFailureMessage(err, "scrapeDo", keySource)}`);
  }
}
