import { NextResponse } from "next/server";
import { z } from "zod";

import { requireAdminSession } from "@/lib/api-auth";
import { proxyRequestToBackend } from "@/lib/backend-bff";
import { scheduledTaskCategorySchema } from "@/lib/scheduled-task-category-schema";
import { validateScheduleInput } from "@/lib/scheduled-task-schedule";
import {
    createScheduledTask,
    listScheduledTasks
} from "@/modules/core-admin/repository";

const createTaskSchema = z.object({
  name: z.string().min(1),
  category: scheduledTaskCategorySchema,
  scheduleCron: z.string().trim().min(5).optional(),
  scheduleRRule: z.string().trim().min(1).max(1024).optional(),
  scheduleDescription: z.string().trim().min(1).max(280).optional(),
  enabled: z.boolean(),
  lastRunAt: z.coerce.date().optional(),
  nextRunAt: z.coerce.date().optional()
});

export async function GET(request: Request) {
  const proxied = await proxyRequestToBackend(request);
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
  return NextResponse.json({ data: tasks });
}

export async function POST(request: Request) {
  const proxied = await proxyRequestToBackend(request);
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
  const scheduleValidation = validateScheduleInput({
    scheduleCron: parsed.data.scheduleCron,
    scheduleRRule: parsed.data.scheduleRRule
  });
  if (!scheduleValidation.ok) {
    return NextResponse.json(
      { error: scheduleValidation.message ?? "Invalid schedule payload" },
      { status: 400 }
    );
  }

  const created = await createScheduledTask({
    ...parsed.data,
    tenantId: session.tenantId
  });
  return NextResponse.json({ data: created }, { status: 201 });
}
