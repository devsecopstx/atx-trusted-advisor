import { NextResponse } from "next/server";

import { requireTenantAutomationSession } from "@/lib/require-tenant-automation-session";
import { serializeTenantUserTaskRunForJson } from "@/lib/tenant-user-scheduled-task-serialize";
import {
    getTenantUserScheduledTaskById,
    listTaskRunsForTaskScoped
} from "@/modules/core-admin/repository";

type RouteContext = { params: Promise<{ taskId: string }> };

export async function GET(request: Request, context: RouteContext) {
  const gate = await requireTenantAutomationSession("read");
  if (!gate.ok) {
    return gate.response;
  }

  const { taskId } = await context.params;
  const task = await getTenantUserScheduledTaskById(taskId, gate.tenantIdHex);
  if (!task?._id) {
    return NextResponse.json({ error: "Task not found" }, { status: 404 });
  }

  const url = new URL(request.url);
  const limitRaw = url.searchParams.get("limit");
  const limit = limitRaw ? Number(limitRaw) : 40;

  const runs = await listTaskRunsForTaskScoped({
    taskId,
    tenantId: gate.tenantIdHex,
    limit: Number.isFinite(limit) ? limit : 40
  });

  return NextResponse.json({
    data: runs.map(serializeTenantUserTaskRunForJson)
  });
}
