import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { withErrorHandling } from "@/lib/apiHandler";
import { requireUser } from "@/lib/auth/currentUser";
import { ownedBy } from "@/lib/auth/access";
import { computeEnrichmentStatus, isManualBrandStatus } from "@/lib/brandStatus";
import type { ApiErrorResponse, UpdateBrandRequest } from "@/lib/types";

function badRequest(message: string) {
  const error: ApiErrorResponse = { error: message };
  return NextResponse.json(error, { status: 400 });
}

/** Typed in by hand, so "acme.com" becomes "https://acme.com". Null = empty, undefined = not a web address. */
function cleanWebsite(value: string | null): string | null | undefined {
  const trimmed = value?.trim();
  if (!trimmed) return null;
  const withScheme = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  try {
    const url = new URL(withScheme);
    return url.hostname.includes(".") ? withScheme : undefined;
  } catch {
    return undefined;
  }
}

function cleanEmail(value: string | null): string | null | undefined {
  const trimmed = value?.trim();
  if (!trimmed) return null;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed) ? trimmed : undefined;
}

export const PATCH = withErrorHandling(
  async (request: Request, { params }: { params: Promise<{ id: string }> }) => {
    const user = await requireUser();
    const { id } = await params;

    let body: UpdateBrandRequest;
    try {
      body = await request.json();
    } catch {
      return badRequest("Invalid JSON body");
    }

    // Someone else's brand looks exactly like one that doesn't exist.
    const existing = await prisma.brand.findFirst({ where: { id, ...ownedBy(user) } });
    if (!existing) {
      const error: ApiErrorResponse = { error: "Brand not found" };
      return NextResponse.json(error, { status: 404 });
    }

    if (body.enrichmentStatus !== undefined && !isManualBrandStatus(body.enrichmentStatus)) {
      return badRequest("Status must be Not started, Found, Partial or Not found");
    }

    let websiteUrl = existing.websiteUrl;
    if (body.websiteUrl !== undefined) {
      const cleaned = cleanWebsite(body.websiteUrl);
      if (cleaned === undefined) return badRequest("That doesn't look like a website address");
      websiteUrl = cleaned;
    }
    let email = existing.email;
    if (body.email !== undefined) {
      const cleaned = cleanEmail(body.email);
      if (cleaned === undefined) return badRequest("That doesn't look like an email address");
      email = cleaned;
    }
    const phone = body.phone !== undefined ? body.phone?.trim() || null : existing.phone;

    // An explicit status wins. Otherwise, when the website or email was changed
    // the status follows them (both = FOUND, one of them = PARTIAL); clearing
    // them both, or only touching the phone, leaves the status alone.
    const contactChanged = websiteUrl !== existing.websiteUrl || email !== existing.email;
    let enrichmentStatus = existing.enrichmentStatus;
    if (body.enrichmentStatus !== undefined) {
      enrichmentStatus = body.enrichmentStatus;
    } else if (contactChanged && (websiteUrl || email)) {
      enrichmentStatus = computeEnrichmentStatus(websiteUrl, email);
    }

    const note = `Edited by ${user.email} on ${new Date().toISOString().slice(0, 10)} — status ${enrichmentStatus}`;

    const brand = await prisma.brand.update({
      where: { id },
      data: {
        ...(body.displayName !== undefined ? { displayName: body.displayName } : {}),
        websiteUrl,
        email,
        phone,
        enrichmentStatus,
        rawNotes: existing.rawNotes ? `${existing.rawNotes}\n${note}` : note,
      },
    });

    return NextResponse.json({
      id: brand.id,
      enrichmentStatus: brand.enrichmentStatus,
      websiteUrl: brand.websiteUrl,
      email: brand.email,
      phone: brand.phone,
    });
  }
);
