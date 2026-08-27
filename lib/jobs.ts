import { prisma } from "@/lib/db";
import {
  Prisma,
  type ScrapeJob,
  type ScrapeJobStatus,
  type ScrapeJobType,
} from "@/lib/generated/prisma/client";
import type { JobDetail, JobLogEntry } from "@/lib/types";

export { summarizeJobInput, jobLabel } from "@/lib/jobSummary";

const MAX_LOG_ENTRIES = 500;

export function toJobDetail(job: ScrapeJob): JobDetail {
  return {
    id: job.id,
    type: job.type,
    status: job.status,
    progress: job.progress,
    totalItems: job.totalItems,
    processedItems: job.processedItems,
    errorCount: job.errorCount,
    createdAt: job.createdAt.toISOString(),
    updatedAt: job.updatedAt.toISOString(),
    input: job.input as unknown as Record<string, unknown>,
    logs: toLogArray(job.logs),
  };
}

function toLogArray(logs: Prisma.JsonValue): JobLogEntry[] {
  return Array.isArray(logs) ? (logs as unknown as JobLogEntry[]) : [];
}

function appendEntry(
  logs: Prisma.JsonValue,
  level: JobLogEntry["level"],
  message: string
): Prisma.InputJsonValue {
  const entry: JobLogEntry = {
    timestamp: new Date().toISOString(),
    level,
    message,
  };
  const next = [...toLogArray(logs), entry].slice(-MAX_LOG_ENTRIES);
  return next as unknown as Prisma.InputJsonValue;
}

export async function createScrapeJob(
  type: ScrapeJobType,
  input: Prisma.InputJsonValue
) {
  return prisma.scrapeJob.create({ data: { type, input } });
}

export async function setJobStatus(
  jobId: string,
  status: ScrapeJobStatus,
  logMessage?: string
) {
  const job = await prisma.scrapeJob.findUniqueOrThrow({
    where: { id: jobId },
    select: { logs: true },
  });
  await prisma.scrapeJob.update({
    where: { id: jobId },
    data: {
      status,
      ...(logMessage ? { logs: appendEntry(job.logs, "info", logMessage) } : {}),
    },
  });
}

export async function setJobTotal(jobId: string, totalItems: number) {
  await prisma.scrapeJob.update({ where: { id: jobId }, data: { totalItems } });
}

export async function appendJobLog(
  jobId: string,
  message: string,
  level: JobLogEntry["level"] = "info"
) {
  const job = await prisma.scrapeJob.findUniqueOrThrow({
    where: { id: jobId },
    select: { logs: true },
  });
  await prisma.scrapeJob.update({
    where: { id: jobId },
    data: { logs: appendEntry(job.logs, level, message) },
  });
}

/**
 * Call once per item as a job works through its list: bumps processedItems
 * (and errorCount on failure), recomputes the 0-100 progress percentage, and
 * appends a log line — all in a single read+write per item.
 */
export async function recordJobItem(
  jobId: string,
  message: string,
  options: { level?: JobLogEntry["level"]; isError?: boolean } = {}
) {
  const job = await prisma.scrapeJob.findUniqueOrThrow({ where: { id: jobId } });
  const processedItems = job.processedItems + 1;
  const errorCount = job.errorCount + (options.isError ? 1 : 0);
  const progress =
    job.totalItems > 0 ? Math.round((processedItems / job.totalItems) * 100) : 0;

  await prisma.scrapeJob.update({
    where: { id: jobId },
    data: {
      processedItems,
      errorCount,
      progress,
      logs: appendEntry(
        job.logs,
        options.isError ? "error" : options.level ?? "info",
        message
      ),
    },
  });
}
