import { NextResponse } from "next/server";

import { requireAdminSession, requireAdminTenantIdHex } from "@/lib/api-auth";
import { proxyAdminScheduledTasksRequestToBackend } from "@/lib/backend-bff";
import {
    claimDueScheduledTaskForExecution,
    listDueScheduledTasks
} from "@/modules/core-admin/repository";
import { executeScheduledTask } from "@/modules/core-admin/task-runner";

export async function POST(request: Request) {
  const proxied = await proxyAdminScheduledTasksRequestToBackend(request);
  if (proxied) {
    return proxied;
  }

  const session = await requireAdminSession();
  if (session instanceof NextResponse) {
    return session;
  }

  const tenantIdHex = await requireAdminTenantIdHex(session);
  if (tenantIdHex instanceof NextResponse) {
    return tenantIdHex;
  }

  const now = new Date();
  const dueTasks = await listDueScheduledTasks(now, {
    tenantId: tenantIdHex
  });
  const results = [];
  for (const task of dueTasks) {
    if (!task._id) {
      continue;
    }
    const claimedTask = await claimDueScheduledTaskForExecution({
      taskId: task._id,
      now,
      tenantId: tenantIdHex
    });
    if (!claimedTask) {
      continue;
    }
    const run = await executeScheduledTask(
      claimedTask,
      `scheduler:${session.username}`,
      {
        userId: session.userId,
        email: session.email,
        username: session.username
      },
      { scheduleAlreadyClaimed: true }
    );
    results.push(run);
  }

  return NextResponse.json({
    data: {
      processed: results.length,
      results
    }
  });
}
