import { NextResponse } from "next/server";
import { z } from "zod";

import {
    isSchedulerInternalSecretValid,
    readSchedulerInternalSecretFromEnv
} from "@/lib/internal-scheduler-execute-auth";
import { buildScheduledTaskExecutorIdentity } from "@/lib/scheduled-task-executor-identity";
import { getScheduledTaskByIdForInternalDelegate } from "@/modules/core-admin/repository";
import { executeScheduledTask } from "@/modules/core-admin/task-runner";

export const maxDuration = 900;

const bodySchema = z.object({
  taskId: z.string().trim().min(1),
  triggeredBy: z.string().trim().min(1).max(200).optional(),
  /**
   * When true, desk US regular-session window gate is skipped (global_admin manual Run from `/admin/tasks`).
   * Cron / system scheduler must omit or pass false.
   */
  bypassMarketWindow: z.boolean().optional()
});

/**
 * Server-to-server: Spring `AdminSchedulerPoller` (or ops) runs scheduled jobs on the **Next** task-runner
 * (Yahoo watchlist, price scanner, options scanner, …). Guard with `X-Atx-Scheduler-Secret` === `ATX_SCHEDULER_INTERNAL_SECRET`.
 */
export async function POST(request: Request) {
  const expected = readSchedulerInternalSecretFromEnv();
  if (!expected) {
    return NextResponse.json(
      { error: "Scheduler delegate is not configured (set ATX_SCHEDULER_INTERNAL_SECRET on Next)" },
      { status: 503 }
    );
  }

  const headerSecret =
    request.headers.get("x-atx-scheduler-secret") ?? request.headers.get("X-Atx-Scheduler-Secret");
  if (!isSchedulerInternalSecretValid(headerSecret, expected)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid body", details: parsed.error.flatten() }, { status: 400 });
  }

  const task = await getScheduledTaskByIdForInternalDelegate(parsed.data.taskId);
  if (!task?._id) {
    return NextResponse.json({ error: "Task not found" }, { status: 404 });
  }

  const triggeredBy =
    parsed.data.triggeredBy?.trim() ||
    "next-scheduler-delegate";

  const result = await executeScheduledTask(task, triggeredBy, undefined, {
    ...(parsed.data.bypassMarketWindow === true ? { bypassMarketWindow: true } : {}),
    executor: buildScheduledTaskExecutorIdentity({
      runtime: "next",
      delegateFrom: "spring"
    })
  });

  return NextResponse.json({
    data: {
      runId: result.runId.toHexString(),
      status: result.status,
      output: result.output
    }
  });
}
