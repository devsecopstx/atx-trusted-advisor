import { NextResponse } from "next/server";

import { requireAdminSession } from "@/lib/api-auth";
import {
  getBatchJobRecord,
  listBatchItemResults,
  pollBatchJob
} from "@/modules/xchat/batch-service";

type RouteContext = {
  params: Promise<{ batchId: string }>;
};

export async function GET(_: Request, context: RouteContext) {
  const session = await requireAdminSession();
  if (session instanceof NextResponse) return session;

  const { batchId } = await context.params;
  const job = await getBatchJobRecord(batchId);
  if (!job) {
    return NextResponse.json({ error: "Batch job not found" }, { status: 404 });
  }

  const items = await listBatchItemResults(batchId);

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
        completedAt: job.completedAt
      },
      items: items.map((item) => ({
        itemId: item.itemId,
        message: item.message,
        scope: item.scope,
        status: item.status,
        responseText: item.responseText ?? null,
        errorMessage: item.errorMessage ?? null
      }))
    }
  });
}

export async function POST(_: Request, context: RouteContext) {
  const session = await requireAdminSession();
  if (session instanceof NextResponse) return session;

  const { batchId } = await context.params;
  const existing = await getBatchJobRecord(batchId);
  if (!existing) {
    return NextResponse.json({ error: "Batch job not found" }, { status: 404 });
  }

  try {
    const updated = await pollBatchJob(batchId);
    return NextResponse.json({
      data: {
        xaiBatchId: updated.xaiBatchId,
        status: updated.status,
        itemCount: updated.itemCount,
        completedCount: updated.completedCount,
        failedCount: updated.failedCount,
        completedAt: updated.completedAt
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
