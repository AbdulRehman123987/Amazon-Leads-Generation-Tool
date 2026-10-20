import { prisma } from "@/lib/db";
import { findContactInfo, computeEnrichmentStatus, INTER_REQUEST_DELAY_MS } from "@/lib/enrichment/findContactInfo";
import { setJobStatus, setJobTotal, recordJobItem, appendJobLog, isJobCancelled } from "@/lib/jobs";
import { ScrapeDoKeyError } from "@/lib/scrapeDo";
import { jobFailureMessage, keySourceNote, resolveApiKey, type KeySource } from "@/lib/apiKeys";
import type { BrandEnrichmentInput } from "@/lib/types";
import type { Brand } from "@/lib/generated/prisma/client";

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function enrichBrand(jobId: string, brand: Brand, apiKey: string): Promise<void> {
  const result = await findContactInfo(jobId, brand.displayName, brand.websiteUrl, apiKey);

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

/**
 * Runs on the job owner's own scrape.do key when they saved one (else the
 * shared key). If scrape.do refuses the key, the job stops and the brand it
 * was on goes back to how it was — a lookup that couldn't run is not "not found".
 */
export async function runBrandEnrichmentJob(jobId: string): Promise<void> {
  const job = await prisma.scrapeJob.findUnique({ where: { id: jobId } });
  if (!job) return;

  const input = job.input as unknown as BrandEnrichmentInput;
  let keySource: KeySource = "shared";

  try {
    if (await isJobCancelled(jobId)) return; // stopped before it even started

    const resolved = await resolveApiKey("scrapeDo", job.userId);
    const apiKey = resolved.key;
    keySource = resolved.source;

    await setJobTotal(jobId, input.brandIds.length);
    await setJobStatus(jobId, "RUNNING", `Starting brand enrichment for ${input.brandIds.length} brand(s)`);
    await appendJobLog(jobId, keySourceNote("scrapeDo", keySource));

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
        await enrichBrand(jobId, brand, apiKey);
        const updated = await prisma.brand.findUniqueOrThrow({ where: { id: brand.id } });
        await recordJobItem(jobId, `Enriched "${brand.displayName}" — ${updated.enrichmentStatus}`);
      } catch (err) {
        if (err instanceof ScrapeDoKeyError) {
          // The lookup never ran: put the brand back as it was, then stop the job.
          await prisma.brand.update({
            where: { id: brand.id },
            data: { enrichmentStatus: brand.enrichmentStatus === "IN_PROGRESS" ? "NOT_STARTED" : brand.enrichmentStatus },
          });
          throw err;
        }
        await prisma.brand.update({ where: { id: brand.id }, data: { enrichmentStatus: "NOT_FOUND" } });
        await recordJobItem(jobId, `Failed to enrich "${brand.displayName}": ${(err as Error).message}`, {
          isError: true,
        });
      }

      await sleep(INTER_REQUEST_DELAY_MS);
    }

    await setJobStatus(jobId, "COMPLETED", `Job finished: ${input.brandIds.length} brand(s) processed`);
  } catch (err) {
    await setJobStatus(jobId, "FAILED", `Job failed: ${jobFailureMessage(err, "scrapeDo", keySource)}`);
  }
}
