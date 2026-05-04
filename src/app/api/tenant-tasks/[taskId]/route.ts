import { NextResponse } from "next/server";
import { z } from "zod";

import { requireTenantAutomationSession } from "@/lib/require-tenant-automation-session";
import {
    computeNextRunAtFromSchedule,
    validateScheduleInput
} from "@/lib/scheduled-task-schedule";
import {
    getMaxTenantUserScheduledTasks,
    tenantUserScheduledTaskCategorySchema
} from "@/lib/tenant-user-scheduled-task-policy";
import { serializeTenantUserScheduledTaskForJson } from "@/lib/tenant-user-scheduled-task-serialize";
import {
    countEnabledTenantUserScheduledTasks,
    deleteScheduledTask,
    getTenantUserScheduledTaskById,
    updateScheduledTask
} from "@/modules/core-admin/repository";

const patchBodySchema = z
  .object({
    name: z.string().trim().min(1).max(200).optional(),
    category: tenantUserScheduledTaskCategorySchema.optional(),
    scheduleCron: z.string().trim().min(5).max(128).optional(),
    scheduleRRule: z.string().trim().min(8).max(1024).nullable().optional(),
    scheduleDescription: z.string().trim().max(280).optional(),
    enabled: z.boolean().optional()
  })
  .refine((o) => Object.keys(o).length > 0, { message: "At least one field required" });

type RouteContext = { params: Promise<{ taskId: string }> };

export async function PATCH(request: Request, context: RouteContext) {
  const gate = await requireTenantAutomationSession("write");
  if (!gate.ok) {
    return gate.response;
  }

  const { taskId } = await context.params;
  const existing = await getTenantUserScheduledTaskById(taskId, gate.tenantIdHex);
  if (!existing?._id) {
    return NextResponse.json({ error: "Task not found" }, { status: 404 });
  }

  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = patchBodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid body", details: parsed.error.flatten() }, { status: 400 });
  }

  const body = parsed.data;
  const nextCron = body.scheduleCron ?? existing.scheduleCron;
  const nextRrule =
    body.scheduleRRule !== undefined ? body.scheduleRRule ?? undefined : existing.scheduleRRule;

  if (body.scheduleCron !== undefined || body.scheduleRRule !== undefined) {
    const vd = validateScheduleInput({
      scheduleCron: nextCron,
      scheduleRRule: nextRrule
    });
    if (!vd.ok) {
      return NextResponse.json({ error: vd.message ?? "Invalid schedule" }, { status: 400 });
    }
  }

  const wantsEnabled = body.enabled !== undefined ? body.enabled : existing.enabled;
  const scheduleChanged =
    body.scheduleCron !== undefined || body.scheduleRRule !== undefined;
  const nextRunAtPatch = scheduleChanged
    ? computeNextRunAtFromSchedule(
        { scheduleCron: nextCron, scheduleRRule: nextRrule },
        new Date()
      ) ?? new Date(Date.now() + 5 * 60 * 1000)
    : undefined;

  const maxTasks = getMaxTenantUserScheduledTasks();
  if (wantsEnabled && !existing.enabled) {
    const enabledCount = await countEnabledTenantUserScheduledTasks(gate.tenantIdHex);
    if (enabledCount >= maxTasks) {
      return NextResponse.json(
        {
          error: `Cannot enable: tenant limit is ${maxTasks} active automations.`,
          code: "tenant_user_task_limit"
        },
        { status: 409 }
      );
    }
  }

  const updated = await updateScheduledTask({
    taskId,
    tenantId: gate.tenantIdHex,
    name: body.name,
    category: body.category,
    scheduleCron: body.scheduleCron,
    scheduleRRule: body.scheduleRRule === null ? null : body.scheduleRRule,
    scheduleDescription: body.scheduleDescription,
    enabled: body.enabled,
    nextRunAt: nextRunAtPatch
  });

  if (!updated?._id) {
    return NextResponse.json({ error: "Task not found" }, { status: 404 });
  }

  return NextResponse.json({ data: serializeTenantUserScheduledTaskForJson(updated) });
}

export async function DELETE(_request: Request, context: RouteContext) {
  const gate = await requireTenantAutomationSession("write");
  if (!gate.ok) {
    return gate.response;
  }

  const { taskId } = await context.params;
  const existing = await getTenantUserScheduledTaskById(taskId, gate.tenantIdHex);
  if (!existing?._id) {
    return NextResponse.json({ error: "Task not found" }, { status: 404 });
  }

  const ok = await deleteScheduledTask({ taskId, tenantId: gate.tenantIdHex });
  if (!ok) {
    return NextResponse.json({ error: "Task not found" }, { status: 404 });
  }

  return NextResponse.json({ data: { deleted: true } });
}
