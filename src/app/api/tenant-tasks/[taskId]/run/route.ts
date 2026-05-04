import { NextResponse } from "next/server";

import { requireTenantAutomationSession } from "@/lib/require-tenant-automation-session";
import { getTenantUserScheduledTaskById } from "@/modules/core-admin/repository";
import { executeScheduledTask } from "@/modules/core-admin/task-runner";

const RUN_COOLDOWN_MS = 45_000;
const lastManualRunAtMs = new Map<string, number>();

function runRateLimitKey(userId: string, taskId: string): string {
  return `${userId}:${taskId}`;
}

type RouteContext = { params: Promise<{ taskId: string }> };

export async function POST(_request: Request, context: RouteContext) {
  const gate = await requireTenantAutomationSession("write");
  if (!gate.ok) {
    return gate.response;
  }

  const { taskId } = await context.params;
  const task = await getTenantUserScheduledTaskById(taskId, gate.tenantIdHex);
  if (!task?._id) {
    return NextResponse.json({ error: "Task not found" }, { status: 404 });
  }

  const rk = runRateLimitKey(gate.session.userId, taskId);
  const now = Date.now();
  const prev = lastManualRunAtMs.get(rk) ?? 0;
  if (now - prev < RUN_COOLDOWN_MS) {
    return NextResponse.json(
      {
        error: "Rate limited — wait before running this task again.",
        code: "tenant_task_run_cooldown",
        retryAfterMs: RUN_COOLDOWN_MS - (now - prev)
      },
      { status: 429 }
    );
  }
  lastManualRunAtMs.set(rk, now);

  const triggeredBy = `user-task:${taskId}`;
  const execution = await executeScheduledTask(
    task,
    triggeredBy,
    {
      userId: gate.session.userId,
      email: gate.session.email,
      username: gate.session.username
    },
    { bypassMarketWindow: true }
  );

  return NextResponse.json({
    data: {
      runId: execution.runId.toHexString(),
      status: execution.status,
      output: execution.output
    }
  });
}
