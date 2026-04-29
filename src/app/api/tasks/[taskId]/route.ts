import { ObjectId } from "mongodb";
import { NextResponse } from "next/server";
import { z } from "zod";

import { requireApprovedAppUserSession } from "@/lib/api-auth";
import { validateScheduleInput } from "@/lib/scheduled-task-schedule";
import { getPortfolioByIdForSessionUser } from "@/modules/core-admin/repository";
import { deleteUserTask, getUserTaskById, updateUserTask } from "@/modules/user-tasks/repository";
import { serializeUserTask } from "@/modules/user-tasks/serialize";
import type { UserTask } from "@/modules/user-tasks/types";
import { cronFromPreset, describeUserTaskSchedule, resolveInitialNextRunAt } from "@/modules/user-tasks/user-task-schedule";

const patchSchema = z.object({
  name: z.string().trim().min(1).max(160).optional(),
  description: z.string().trim().max(500).nullable().optional(),
  prompt: z.string().min(4).max(8000).optional(),
  personaId: z.string().trim().max(64).nullable().optional(),
  portfolioId: z.string().trim().regex(/^[a-f\d]{24}$/i).nullable().optional(),
  enabled: z.boolean().optional(),
  schedule: z
    .object({
      preset: z.enum(["daily", "weekly", "monthly"]).optional(),
      cron: z.string().trim().min(5).max(120).optional(),
      rrule: z.string().trim().min(8).max(1024).optional()
    })
    .optional(),
  delivery: z.array(z.enum(["in_app", "email"])).min(1).optional(),
  params: z
    .object({
      scope: z.enum(["portfolio", "watchlist", "all"]).optional(),
      riskProfile: z.enum(["conservative", "balanced", "aggressive"]).optional(),
      symbols: z.array(z.string().trim().min(1).max(16)).max(64).optional()
    })
    .nullable()
    .optional(),
  timeZone: z.string().trim().max(64).nullable().optional()
});

export async function GET(_request: Request, context: { params: Promise<{ taskId: string }> }) {
  const session = await requireApprovedAppUserSession();
  if (session instanceof NextResponse) {
    return session;
  }
  const { taskId } = await context.params;
  if (!ObjectId.isValid(session.tenantId) || !ObjectId.isValid(session.userId)) {
    return NextResponse.json({ error: "Invalid session scope" }, { status: 400 });
  }
  const row = await getUserTaskById({
    taskId,
    tenantId: new ObjectId(session.tenantId),
    userId: new ObjectId(session.userId)
  });
  if (!row) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  return NextResponse.json({ data: serializeUserTask(row) });
}

export async function PATCH(request: Request, context: { params: Promise<{ taskId: string }> }) {
  const session = await requireApprovedAppUserSession();
  if (session instanceof NextResponse) {
    return session;
  }
  const { taskId } = await context.params;
  if (!ObjectId.isValid(session.tenantId) || !ObjectId.isValid(session.userId)) {
    return NextResponse.json({ error: "Invalid session scope" }, { status: 400 });
  }
  const tenantId = new ObjectId(session.tenantId);
  const userId = new ObjectId(session.userId);

  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const parsed = patchSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid payload", details: parsed.error.flatten() }, { status: 400 });
  }

  const patch: Parameters<typeof updateUserTask>[0]["patch"] = {
    updatedByUserId: userId
  };

  const data = parsed.data;
  if (data.name !== undefined) {
    patch.name = data.name.trim();
  }
  if (data.description !== undefined) {
    patch.description = data.description === null ? undefined : data.description.trim();
  }
  if (data.prompt !== undefined) {
    patch.prompt = data.prompt.trim();
  }
  if (data.personaId !== undefined) {
    patch.personaId = data.personaId;
  }
  if (data.enabled !== undefined) {
    patch.enabled = data.enabled;
  }
  if (data.delivery !== undefined) {
    patch.delivery = data.delivery;
  }
  if (data.params !== undefined) {
    patch.params = data.params === null ? undefined : data.params;
  }
  if (data.timeZone !== undefined) {
    patch.timeZone = data.timeZone === null ? undefined : data.timeZone.trim();
  }

  if (data.portfolioId !== undefined) {
    if (data.portfolioId === null) {
      patch.portfolioId = null;
    } else {
      const p = await getPortfolioByIdForSessionUser({
        userId: session.userId,
        tenantId: session.tenantId,
        portfolioId: data.portfolioId
      });
      if (!p?._id) {
        return NextResponse.json({ error: "Portfolio not found", code: "portfolio_not_found" }, { status: 404 });
      }
      patch.portfolioId = p._id;
    }
  }

  if (data.schedule) {
    const sch = data.schedule;
    let scheduleCron: string | undefined;
    let scheduleRRule: string | undefined;
    let schedulePreset: UserTask["schedulePreset"];
    if (sch.preset) {
      scheduleCron = sch.cron?.trim() || cronFromPreset(sch.preset);
      scheduleRRule = sch.rrule?.trim();
      schedulePreset = sch.preset;
    } else {
      scheduleCron = sch.cron?.trim();
      scheduleRRule = sch.rrule?.trim();
      schedulePreset = null;
    }
    const vd = validateScheduleInput({ scheduleCron, scheduleRRule });
    if (!vd.ok) {
      return NextResponse.json({ error: vd.message ?? "Invalid schedule" }, { status: 400 });
    }
    patch.scheduleCron = scheduleCron;
    patch.scheduleRRule = scheduleRRule;
    patch.schedulePreset = schedulePreset;
    patch.scheduleDescription = describeUserTaskSchedule({
      scheduleCron,
      scheduleRRule,
      scheduleDescription: undefined
    });
    patch.nextRunAt = resolveInitialNextRunAt({ scheduleCron, scheduleRRule });
  }

  const updated = await updateUserTask({
    taskId,
    tenantId,
    userId,
    patch
  });
  if (!updated) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  return NextResponse.json({ data: serializeUserTask(updated) });
}

export async function DELETE(_request: Request, context: { params: Promise<{ taskId: string }> }) {
  const session = await requireApprovedAppUserSession();
  if (session instanceof NextResponse) {
    return session;
  }
  const { taskId } = await context.params;
  if (!ObjectId.isValid(session.tenantId) || !ObjectId.isValid(session.userId)) {
    return NextResponse.json({ error: "Invalid session scope" }, { status: 400 });
  }
  const ok = await deleteUserTask({
    taskId,
    tenantId: new ObjectId(session.tenantId),
    userId: new ObjectId(session.userId)
  });
  if (!ok) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}
