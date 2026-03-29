import { NextResponse } from "next/server";
import { z } from "zod";

import { serializeScheduledTaskForJson } from "@/lib/admin-scheduled-task-serialize";
import { requireAdminSession } from "@/lib/api-auth";
import { proxyRequestToBackend } from "@/lib/backend-bff";
import { scheduledTaskCategorySchema } from "@/lib/scheduled-task-category-schema";
import {
    normalizeScheduledTaskSchedule,
    scheduledTaskScheduleObjectSchema
} from "@/lib/scheduled-task-request-payload";
import { validateScheduleInput } from "@/lib/scheduled-task-schedule";
import {
    adminGetPortfolioById,
    deleteScheduledTask,
    getScheduledTaskById,
    updateScheduledTask
} from "@/modules/core-admin/repository";

type RouteContext = {
  params: Promise<{ portfolioId: string; taskId: string }>;
};

const patchTaskSchema = z
  .object({
    name: z.string().trim().min(1).max(200).optional(),
    category: scheduledTaskCategorySchema.optional(),
    schedule: scheduledTaskScheduleObjectSchema,
    scheduleCron: z.string().trim().min(5).max(128).optional(),
    scheduleRRule: z.union([z.string().trim().min(1).max(1024), z.null()]).optional(),
    scheduleDescription: z.string().trim().min(1).max(280).optional(),
    enabled: z.boolean().optional(),
    nextRunAt: z.union([z.coerce.date(), z.null()]).optional()
  })
  .refine(
    (d) =>
      d.name !== undefined ||
      d.category !== undefined ||
      d.schedule !== undefined ||
      d.scheduleCron !== undefined ||
      d.scheduleRRule !== undefined ||
      d.scheduleDescription !== undefined ||
      d.enabled !== undefined ||
      d.nextRunAt !== undefined,
    { message: "At least one field is required" }
  );

export async function PATCH(request: Request, context: RouteContext) {
  const proxied = await proxyRequestToBackend(request);
  if (proxied) {
    return proxied;
  }

  const session = await requireAdminSession();
  if (session instanceof NextResponse) {
    return session;
  }

  const { portfolioId, taskId } = await context.params;
  const portfolio = await adminGetPortfolioById(portfolioId);
  if (!portfolio?._id) {
    return NextResponse.json({ error: "Portfolio not found" }, { status: 404 });
  }

  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = patchTaskSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid payload", details: parsed.error.flatten() },
      { status: 400 }
    );
  }
  const existing = await getScheduledTaskById(taskId, { tenantId: session.tenantId });
  if (!existing?._id || existing.portfolioId?.toHexString() !== portfolioId) {
    return NextResponse.json({ error: "Task not found" }, { status: 404 });
  }
  const normalizedSchedule = normalizeScheduledTaskSchedule(parsed.data);
  if (parsed.data.schedule !== undefined || parsed.data.scheduleCron !== undefined || parsed.data.scheduleRRule !== undefined) {
    const scheduleValidation = validateScheduleInput({
      scheduleCron:
        normalizedSchedule.scheduleCron !== undefined
          ? normalizedSchedule.scheduleCron
          : existing.scheduleCron,
      scheduleRRule:
        normalizedSchedule.scheduleRRule !== undefined
          ? normalizedSchedule.scheduleRRule
          : existing.scheduleRRule
    });
    if (!scheduleValidation.ok) {
      return NextResponse.json(
        { error: scheduleValidation.message ?? "Invalid schedule payload" },
        { status: 400 }
      );
    }
  }

  const updated = await updateScheduledTask({
    taskId,
    tenantId: session.tenantId,
    expectedPortfolioId: portfolioId,
    name: parsed.data.name,
    category: parsed.data.category,
    scheduleCron: normalizedSchedule.scheduleCron,
    scheduleRRule: normalizedSchedule.scheduleRRule,
    scheduleDescription: normalizedSchedule.scheduleDescription,
    enabled: parsed.data.enabled,
    nextRunAt: parsed.data.nextRunAt === null ? null : parsed.data.nextRunAt
  });

  if (!updated) {
    return NextResponse.json({ error: "Task not found" }, { status: 404 });
  }

  return NextResponse.json({ data: serializeScheduledTaskForJson(updated) });
}

export async function DELETE(request: Request, context: RouteContext) {
  const proxied = await proxyRequestToBackend(request);
  if (proxied) {
    return proxied;
  }

  const session = await requireAdminSession();
  if (session instanceof NextResponse) {
    return session;
  }

  const { portfolioId, taskId } = await context.params;
  const portfolio = await adminGetPortfolioById(portfolioId);
  if (!portfolio?._id) {
    return NextResponse.json({ error: "Portfolio not found" }, { status: 404 });
  }

  const ok = await deleteScheduledTask({
    taskId,
    tenantId: session.tenantId,
    expectedPortfolioId: portfolioId
  });
  if (!ok) {
    return NextResponse.json({ error: "Task not found" }, { status: 404 });
  }

  return NextResponse.json({ ok: true });
}
