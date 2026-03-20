import { NextResponse } from "next/server";

import { requireAdminSession } from "@/lib/api-auth";
import { checkRateLimit } from "@/lib/rate-limit";
import { toBatchDashboardJob } from "@/modules/xchat/batch-dashboard";
import {
  getBatchJobRecord,
  listBatchItemResults,
  pollBatchJob
} from "@/modules/xchat/batch-service";

type RouteContext = {
  params: Promise<{ batchId: string }>;
};

const BATCH_DETAIL_RATE_WINDOW_MS = 60_000;
const BATCH_DETAIL_RATE_MAX = 30;
const BATCH_POLL_RATE_WINDOW_MS = 60_000;
const BATCH_POLL_RATE_MAX = 10;

export async function GET(_: Request, context: RouteContext) {
  const session = await requireAdminSession();
  if (session instanceof NextResponse) return session;

  const rateLimit = checkRateLimit({
    key: `xchat-batch-detail:${session.userId}`,
    windowMs: BATCH_DETAIL_RATE_WINDOW_MS,
    max: BATCH_DETAIL_RATE_MAX
  });
  if (!rateLimit.allowed) {
    return NextResponse.json(
      { error: "Rate limit exceeded", retryAfterSeconds: Math.ceil((rateLimit.resetAtMs - Date.now()) / 1000) },
      { status: 429 }
    );
  }

  const { batchId } = await context.params;
  const job = await getBatchJobRecord(batchId);
  if (!job) {
    return NextResponse.json({ error: "Batch job not found" }, { status: 404 });
  }

  const items = await listBatchItemResults(batchId);
  const lastError =
    items.find((item) => item.status === "failed" && item.errorMessage)?.errorMessage ?? null;
  const dashboard = toBatchDashboardJob(job, lastError);

  return NextResponse.json({
    data: {
      job: {
        xaiBatchId: job.xaiBatchId,
        personaName: job.personaName,
        status: job.status,
        itemCount: job.itemCount,
        completedCount: job.completedCount,
        failedCount: job.failedCount,
        submittedBy: job.submittedBy,
        createdAt: job.createdAt,
        completedAt: job.completedAt,
        dashboard
      },
      items: items.map((item) => ({
        itemId: item.itemId,
        message: item.message,
        scope: item.scope,
        status: item.status,
        xaiRequestState: item.xaiRequestState ?? null,
        xaiStatusCode: item.xaiStatusCode ?? null,
        xaiErrorCode: item.xaiErrorCode ?? null,
        responseText: item.responseText ?? null,
        errorMessage: item.errorMessage ?? null
      }))
    }
  });
}

export async function POST(_: Request, context: RouteContext) {
  const session = await requireAdminSession();
  if (session instanceof NextResponse) return session;

  const rateLimit = checkRateLimit({
    key: `xchat-batch-poll:${session.userId}`,
    windowMs: BATCH_POLL_RATE_WINDOW_MS,
    max: BATCH_POLL_RATE_MAX
  });
  if (!rateLimit.allowed) {
    return NextResponse.json(
      { error: "Rate limit exceeded", retryAfterSeconds: Math.ceil((rateLimit.resetAtMs - Date.now()) / 1000) },
      { status: 429 }
    );
  }

  const { batchId } = await context.params;
  const existing = await getBatchJobRecord(batchId);
  if (!existing) {
    return NextResponse.json({ error: "Batch job not found" }, { status: 404 });
  }

  try {
    const updated = await pollBatchJob(batchId);
    const dashboard = toBatchDashboardJob(updated);
    return NextResponse.json({
      data: {
        xaiBatchId: updated.xaiBatchId,
        status: updated.status,
        itemCount: updated.itemCount,
        completedCount: updated.completedCount,
        failedCount: updated.failedCount,
        completedAt: updated.completedAt,
        dashboard
      }
    });
  } catch (error) {
    console.error(
      "[xchat/batch] poll failed:",
      error instanceof Error ? error.message : error
    );
    return NextResponse.json(
      { error: "Batch poll failed", retryable: true },
      { status: 502 }
    );
  }
}
