import { NextResponse } from "next/server";

import { requireAdminSession, requireAdminTenantIdHex } from "@/lib/api-auth";
import { executeScheduledTask } from "@/modules/core-admin/task-runner";
import { getMarketingScheduleById } from "@/modules/marketing/repository";

type RouteContext = { params: Promise<{ scheduleId: string }> };

export async function POST(_request: Request, context: RouteContext) {
  const session = await requireAdminSession();
  if (session instanceof NextResponse) {
    return session;
  }
  const tenantIdHex = await requireAdminTenantIdHex(session);
  if (tenantIdHex instanceof NextResponse) {
    return tenantIdHex;
  }

  const { scheduleId } = await context.params;
  const schedule = await getMarketingScheduleById(scheduleId, tenantIdHex);
  if (!schedule) {
    return NextResponse.json({ error: "Schedule not found" }, { status: 404 });
  }

  const execution = await executeScheduledTask(
    schedule,
    "marketing-scheduler",
    {
      userId: session.userId,
      email: session.email,
      username: session.username
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
