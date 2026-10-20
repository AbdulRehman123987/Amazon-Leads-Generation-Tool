import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { toJobDetail } from "@/lib/jobs";
import { withErrorHandling } from "@/lib/apiHandler";
import { requireUser } from "@/lib/auth/currentUser";
import { ownedBy } from "@/lib/auth/access";
import type { ApiErrorResponse } from "@/lib/types";

export const GET = withErrorHandling(
  async (_request: Request, { params }: { params: Promise<{ id: string }> }) => {
    const user = await requireUser();
    const { id } = await params;
    // Someone else's job looks exactly like one that doesn't exist.
    const job = await prisma.scrapeJob.findFirst({ where: { id, ...ownedBy(user) } });

    if (!job) {
      const error: ApiErrorResponse = { error: "Job not found" };
      return NextResponse.json(error, { status: 404 });
    }

    return NextResponse.json(toJobDetail(job));
  }
);
