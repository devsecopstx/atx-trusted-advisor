import { NextResponse } from "next/server";
import { z } from "zod";

import { requireAdminSession } from "@/lib/api-auth";
import { checkRateLimit } from "@/lib/rate-limit";
import { getPersonaById } from "@/modules/xchat/repository";
import {
  buildBatchDashboardSummary,
  toBatchDashboardJob
} from "@/modules/xchat/batch-dashboard";
import {
  listBatchJobs,
  submitBatchJob
} from "@/modules/xchat/batch-service";

const submitBatchSchema = z.object({
  personaId: z.string().min(1),
  items: z
    .array(
      z.object({
        itemId: z.string().min(1).max(128),
        message: z.string().min(2).max(8_000),
        scope: z.string().min(1).max(128).optional()
      })
    )
    .min(1)
    .max(500)
});

const BATCH_RATE_WINDOW_MS = 60_000;
const BATCH_RATE_MAX = 5;

export async function POST(request: Request) {
  const session = await requireAdminSession();
  if (session instanceof NextResponse) return session;

  const rateLimit = checkRateLimit({
    key: `xchat-batch:${session.userId}`,
    windowMs: BATCH_RATE_WINDOW_MS,
    max: BATCH_RATE_MAX
  });
  if (!rateLimit.allowed) {
    return NextResponse.json(
      {
        error: "Rate limit exceeded",
        retryAfterSeconds: Math.ceil(
          (rateLimit.resetAtMs - Date.now()) / 1000
        )
      },
      { status: 429 }
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON payload" },
      { status: 400 }
    );
  }

  const parsed = submitBatchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid batch payload", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const persona = await getPersonaById(parsed.data.personaId);
  if (!persona) {
    return NextResponse.json(
      { error: "Persona not found" },
      { status: 404 }
    );
  }

  try {
    const job = await submitBatchJob({
      personaId: parsed.data.personaId,
      persona,
      items: parsed.data.items,
      userId: session.userId,
      tenantId: session.tenantId,
      submittedBy: session.username
    });

    return NextResponse.json(
      {
        data: {
          xaiBatchId: job.xaiBatchId,
          status: job.status,
          itemCount: job.itemCount
        }
      },
      { status: 201 }
    );
  } catch (error) {
    console.error(
      "[xchat/batch] submit failed:",
      error instanceof Error ? error.message : error
    );
    return NextResponse.json(
      { error: "Batch submission failed", retryable: true },
      { status: 502 }
    );
  }
}

const BATCH_LIST_RATE_WINDOW_MS = 60_000;
const BATCH_LIST_RATE_MAX = 30;

export async function GET() {
  const session = await requireAdminSession();
  if (session instanceof NextResponse) return session;

  const rateLimit = checkRateLimit({
    key: `xchat-batch-list:${session.userId}`,
    windowMs: BATCH_LIST_RATE_WINDOW_MS,
    max: BATCH_LIST_RATE_MAX
  });
  if (!rateLimit.allowed) {
    return NextResponse.json(
      { error: "Rate limit exceeded", retryAfterSeconds: Math.ceil((rateLimit.resetAtMs - Date.now()) / 1000) },
      { status: 429 }
    );
  }

  const jobs = await listBatchJobs({
    tenantId: session.tenantId,
    limit: 50
  });
  const dashboardJobs = jobs.map((job) => toBatchDashboardJob(job));
  const summary = buildBatchDashboardSummary(dashboardJobs);

  return NextResponse.json({
    data: jobs.map((job, index) => ({
      xaiBatchId: job.xaiBatchId,
      personaName: job.personaName,
      status: job.status,
      itemCount: job.itemCount,
      completedCount: job.completedCount,
      failedCount: job.failedCount,
      submittedBy: job.submittedBy,
      createdAt: job.createdAt,
      completedAt: job.completedAt,
      dashboard: dashboardJobs[index]
    })),
    summary
  });
}
