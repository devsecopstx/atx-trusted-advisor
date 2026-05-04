import { NextResponse } from "next/server";
import { z } from "zod";

import { requireTenantAutomationSession } from "@/lib/require-tenant-automation-session";
import { validateScheduleInput } from "@/lib/scheduled-task-schedule";
import {
    getMaxTenantUserScheduledTasks,
    tenantUserScheduledTaskCategorySchema
} from "@/lib/tenant-user-scheduled-task-policy";
import { serializeTenantUserScheduledTaskForJson } from "@/lib/tenant-user-scheduled-task-serialize";
import {
    countEnabledTenantUserScheduledTasks,
    insertTenantUserScheduledTask,
    listTenantUserScheduledTasks
} from "@/modules/core-admin/repository";

const createBodySchema = z.object({
  name: z.string().trim().min(1).max(200),
  category: tenantUserScheduledTaskCategorySchema,
  scheduleCron: z.string().trim().min(5).max(128).optional(),
  scheduleRRule: z.string().trim().min(8).max(1024).optional(),
  scheduleDescription: z.string().trim().max(280).optional(),
  enabled: z.boolean().optional().default(true)
});

export async function GET() {
  const gate = await requireTenantAutomationSession("read");
  if (!gate.ok) {
    return gate.response;
  }

  const tasks = await listTenantUserScheduledTasks(gate.tenantIdHex);
  const enabledCount = await countEnabledTenantUserScheduledTasks(gate.tenantIdHex);
  const maxTasks = getMaxTenantUserScheduledTasks();

  return NextResponse.json({
    data: tasks.map(serializeTenantUserScheduledTaskForJson),
    meta: {
      enabledCount,
      maxTasks,
      softWarningThreshold: 3
    }
  });
}

export async function POST(request: Request) {
  const gate = await requireTenantAutomationSession("write");
  if (!gate.ok) {
    return gate.response;
  }

  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = createBodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid body", details: parsed.error.flatten() }, { status: 400 });
  }

  const body = parsed.data;
  const vd = validateScheduleInput({
    scheduleCron: body.scheduleCron,
    scheduleRRule: body.scheduleRRule
  });
  if (!vd.ok) {
    return NextResponse.json({ error: vd.message ?? "Invalid schedule" }, { status: 400 });
  }

  const enabledTarget = body.enabled !== false;
  const enabledCount = await countEnabledTenantUserScheduledTasks(gate.tenantIdHex);
  const maxTasks = getMaxTenantUserScheduledTasks();
  if (enabledTarget && enabledCount >= maxTasks) {
    return NextResponse.json(
      {
        error: `Tenant automation limit reached (${maxTasks} enabled tasks). Disable or delete a task to add another.`,
        code: "tenant_user_task_limit"
      },
      { status: 409 }
    );
  }

  const task = await insertTenantUserScheduledTask({
    tenantIdHex: gate.tenantIdHex,
    ownerUserIdHex: gate.session.userId,
    name: body.name,
    category: body.category,
    scheduleCron: body.scheduleCron,
    scheduleRRule: body.scheduleRRule,
    scheduleDescription: body.scheduleDescription,
    enabled: enabledTarget
  });

  return NextResponse.json({ data: serializeTenantUserScheduledTaskForJson(task) }, { status: 201 });
}
