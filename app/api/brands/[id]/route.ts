import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { withErrorHandling } from "@/lib/apiHandler";
import type { ApiErrorResponse, UpdateBrandRequest } from "@/lib/types";

export const PATCH = withErrorHandling(
  async (request: Request, { params }: { params: Promise<{ id: string }> }) => {
    const { id } = await params;

    let body: UpdateBrandRequest;
    try {
      body = await request.json();
    } catch {
      const error: ApiErrorResponse = { error: "Invalid JSON body" };
      return NextResponse.json(error, { status: 400 });
    }

    const existing = await prisma.brand.findUnique({ where: { id } });
    if (!existing) {
      const error: ApiErrorResponse = { error: "Brand not found" };
      return NextResponse.json(error, { status: 404 });
    }

    const brand = await prisma.brand.update({
      where: { id },
      data: {
        ...(body.displayName !== undefined ? { displayName: body.displayName } : {}),
        ...(body.websiteUrl !== undefined ? { websiteUrl: body.websiteUrl } : {}),
        ...(body.email !== undefined ? { email: body.email } : {}),
        ...(body.phone !== undefined ? { phone: body.phone } : {}),
      },
    });

    return NextResponse.json({ id: brand.id });
  }
);
