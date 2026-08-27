import { prisma } from "@/lib/db";
import type { Brand } from "@/lib/generated/prisma/client";

export function normalizeBrandName(raw: string): string {
  return raw.trim().toLowerCase().replace(/\s+/g, " ");
}

/**
 * Finds a Brand by normalized name, or creates one. Deliberately never
 * touches displayName/website/email/phone on an existing row — those belong
 * to the enrichment step and to manual corrections made in the UI, not to
 * whatever a later Amazon re-scrape happened to read off the byline.
 */
export async function findOrCreateBrand(rawName: string): Promise<Brand> {
  const name = normalizeBrandName(rawName);
  const existing = await prisma.brand.findUnique({ where: { name } });
  if (existing) return existing;
  return prisma.brand.create({ data: { name, displayName: rawName.trim() } });
}
