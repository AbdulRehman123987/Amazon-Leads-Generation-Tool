import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { toJobDetail } from "@/lib/jobs";
import { withErrorHandling } from "@/lib/apiHandler";
import type { ApiErrorResponse } from "@/lib/types";

export const GET = withErrorHandling(
  async (_request: Request, { params }: { params: Promise<{ id: string }> }) => {
    const { id } = await params;
    const job = await prisma.scrapeJob.findUnique({ where: { id } });

    if (!job) {
      const error: ApiErrorResponse = { error: "Job not found" };
      return NextResponse.json(error, { status: 404 });
    }

    return NextResponse.json(toJobDetail(job));
  }
);
