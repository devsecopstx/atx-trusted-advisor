import { NextResponse } from "next/server";

import { requireAdminSession, requireAdminTenantIdHex } from "@/lib/api-auth";
import { proxyAdminScheduledTasksRequestToBackend } from "@/lib/backend-bff";
import { listDueScheduledTasks } from "@/modules/core-admin/repository";
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

  const dueTasks = await listDueScheduledTasks(new Date(), {
    tenantId: tenantIdHex
  });
  const results = await Promise.all(
    dueTasks.map(async (task) =>
      executeScheduledTask(task, `scheduler:${session.username}`, {
        userId: session.userId,
        email: session.email,
        username: session.username
      })
    )
  );

  return NextResponse.json({
    data: {
      processed: results.length,
      results
    }
  });
}
