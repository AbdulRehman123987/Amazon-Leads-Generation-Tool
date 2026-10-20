import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { cancelScrapeJob } from "@/lib/jobs";
import { withErrorHandling } from "@/lib/apiHandler";
import { requireUser } from "@/lib/auth/currentUser";
import { ownedBy } from "@/lib/auth/access";
import type { ApiErrorResponse } from "@/lib/types";

// Stops a job that is pending or running — for a scrape started by mistake. It
// finishes the item it is on and keeps everything found so far. Also clears a
// job that is stuck "running" after its window was closed.
export const POST = withErrorHandling(
  async (_request: Request, { params }: { params: Promise<{ id: string }> }) => {
    const user = await requireUser();
    const { id } = await params;

    // Someone else's job looks exactly like one that doesn't exist.
    const job = await prisma.scrapeJob.findFirst({ where: { id, ...ownedBy(user) }, select: { id: true } });
    if (!job) {
      const error: ApiErrorResponse = { error: "Job not found" };
      return NextResponse.json(error, { status: 404 });
    }

    const stopped = await cancelScrapeJob(id, user.email);
    if (!stopped) {
      const error: ApiErrorResponse = { error: "This job has already finished." };
      return NextResponse.json(error, { status: 409 });
    }

    return NextResponse.json({ ok: true });
  }
);
