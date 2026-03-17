import { NextResponse } from "next/server";

import { requireAdminSession } from "@/lib/api-auth";
import { getScheduledTaskById } from "@/modules/core-admin/repository";
import { executeScheduledTask } from "@/modules/core-admin/task-runner";

type RouteContext = {
  params: Promise<{ taskId: string }>;
};

export async function POST(_: Request, context: RouteContext) {
  const session = await requireAdminSession();
  if (session instanceof NextResponse) {
    return session;
  }

  const { taskId } = await context.params;
  const task = await getScheduledTaskById(taskId, {
    tenantId: session.tenantId
  });
  if (!task?._id) {
    return NextResponse.json({ error: "Task not found" }, { status: 404 });
  }

  const execution = await executeScheduledTask(task, session.username);
  return NextResponse.json({
    data: {
      runId: execution.runId,
      status: execution.status,
      output: execution.output
    }
  });
}
