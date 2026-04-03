import { NextResponse } from "next/server";
import { z } from "zod";

import { serializeScheduledTaskForJson } from "@/lib/admin-scheduled-task-serialize";
import { requireAdminSession } from "@/lib/api-auth";
import { proxyAdminScheduledTasksRequestToBackend } from "@/lib/backend-bff";
import { scheduledTaskCategorySchema } from "@/lib/scheduled-task-category-schema";
import {
    DeliveryChannelTargetError,
    resolveDeliveryChannelTargetForCreate
} from "@/lib/scheduled-task-delivery-channel";
import {
    normalizeScheduledTaskSchedule,
    scheduledTaskScheduleObjectSchema
} from "@/lib/scheduled-task-request-payload";
import { validateScheduleInput } from "@/lib/scheduled-task-schedule";
import {
    createScheduledTask,
    listScheduledTasks
} from "@/modules/core-admin/repository";

const createTaskSchema = z.object({
  name: z.string().min(1),
  category: scheduledTaskCategorySchema,
  schedule: scheduledTaskScheduleObjectSchema,
  scheduleCron: z.string().trim().min(5).optional(),
  scheduleRRule: z.string().trim().min(1).max(1024).optional(),
  scheduleDescription: z.string().trim().min(1).max(280).optional(),
  enabled: z.boolean(),
  lastRunAt: z.coerce.date().optional(),
  nextRunAt: z.coerce.date().optional(),
  deliveryChannelTarget: z.string().trim().optional()
});

export async function GET(request: Request) {
  const proxied = await proxyAdminScheduledTasksRequestToBackend(request);
  if (proxied) {
    return proxied;
  }

  const session = await requireAdminSession();
  if (session instanceof NextResponse) {
    return session;
  }

  const tasks = await listScheduledTasks({
    tenantId: session.tenantId
  });
  return NextResponse.json({ data: tasks.map(serializeScheduledTaskForJson) });
}

export async function POST(request: Request) {
  const proxied = await proxyAdminScheduledTasksRequestToBackend(request);
  if (proxied) {
    return proxied;
  }

  const session = await requireAdminSession();
  if (session instanceof NextResponse) {
    return session;
  }

  const json = await request.json();
  const parsed = createTaskSchema.safeParse(json);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid request payload", details: parsed.error.flatten() },
      { status: 400 }
    );
  }
  const normalizedSchedule = normalizeScheduledTaskSchedule(parsed.data);
  const scheduleValidation = validateScheduleInput(normalizedSchedule);
  if (!scheduleValidation.ok) {
    return NextResponse.json(
      { error: scheduleValidation.message ?? "Invalid schedule payload" },
      { status: 400 }
    );
  }

  let deliveryChannelTarget;
  try {
    deliveryChannelTarget = await resolveDeliveryChannelTargetForCreate(
      parsed.data.deliveryChannelTarget,
      session.tenantId
    );
  } catch (e) {
    if (e instanceof DeliveryChannelTargetError) {
      return NextResponse.json({ error: e.message }, { status: 400 });
    }
    throw e;
  }

  const created = await createScheduledTask({
    name: parsed.data.name,
    category: parsed.data.category,
    enabled: parsed.data.enabled,
    lastRunAt: parsed.data.lastRunAt,
    nextRunAt: parsed.data.nextRunAt,
    scheduleCron: normalizedSchedule.scheduleCron,
    scheduleRRule: normalizedSchedule.scheduleRRule,
    scheduleDescription: normalizedSchedule.scheduleDescription,
    tenantId: session.tenantId,
    ...(deliveryChannelTarget ? { deliveryChannelTarget } : {})
  });
  return NextResponse.json({ data: serializeScheduledTaskForJson(created) }, { status: 201 });
}
