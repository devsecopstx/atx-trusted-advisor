import { NextResponse } from "next/server";

import { requireAdminSession } from "@/lib/api-auth";
import { listDueScheduledTasks } from "@/modules/core-admin/repository";
import { executeScheduledTask } from "@/modules/core-admin/task-runner";

export async function POST() {
  const session = await requireAdminSession();
  if (session instanceof NextResponse) {
    return session;
  }

  const dueTasks = await listDueScheduledTasks(new Date(), {
    tenantId: session.tenantId
  });
  const results = await Promise.all(
    dueTasks.map(async (task) => executeScheduledTask(task, `scheduler:${session.username}`))
  );

  return NextResponse.json({
    data: {
      processed: results.length,
      results
    }
  });
}
