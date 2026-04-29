import { NextResponse } from "next/server";

import {
    isSchedulerInternalSecretValid,
    readSchedulerInternalSecretFromEnv
} from "@/lib/internal-scheduler-execute-auth";
import { listDueUserTasks } from "@/modules/user-tasks/repository";
import { processDueUserTaskById } from "@/modules/user-tasks/run-user-task";

export const maxDuration = 900;

/**
 * Server-to-server: process due `user_tasks` (cron / Spring ops). Guard with `X-Atx-Scheduler-Secret`.
 */
export async function POST(request: Request) {
  const expected = readSchedulerInternalSecretFromEnv();
  if (!expected) {
    return NextResponse.json(
      { error: "Scheduler secret not configured (set ATX_SCHEDULER_INTERNAL_SECRET)" },
      { status: 503 }
    );
  }
  const headerSecret =
    request.headers.get("x-atx-scheduler-secret") ?? request.headers.get("X-Atx-Scheduler-Secret");
  if (!isSchedulerInternalSecretValid(headerSecret, expected)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const now = new Date();
  const due = await listDueUserTasks(now, 40);
  const results: Array<{ taskId: string; ok: boolean; message: string }> = [];
  for (const task of due) {
    if (!task._id) {
      continue;
    }
    const r = await processDueUserTaskById({
      taskId: task._id,
      now,
      triggeredBy: "scheduler:user_tasks"
    });
    results.push({ taskId: task._id.toHexString(), ok: r.ok, message: r.message });
  }

  return NextResponse.json({
    data: {
      processed: results.length,
      results
    }
  });
}
