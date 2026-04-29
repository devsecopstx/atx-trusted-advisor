import { ObjectId } from "mongodb";
import { NextResponse } from "next/server";
import { z } from "zod";

import { requireApprovedAppUserSession } from "@/lib/api-auth";
import { validateScheduleInput } from "@/lib/scheduled-task-schedule";
import { getPortfolioByIdForSessionUser } from "@/modules/core-admin/repository";
import {
    countUserTasksForUser,
    insertUserTask,
    listUserTasksForUser
} from "@/modules/user-tasks/repository";
import { serializeUserTask } from "@/modules/user-tasks/serialize";
import type { UserTask, UserTaskDeliveryChannel } from "@/modules/user-tasks/types";
import { MAX_USER_TASKS_PER_USER } from "@/modules/user-tasks/user-task-constants";
import { cronFromPreset, describeUserTaskSchedule, resolveInitialNextRunAt } from "@/modules/user-tasks/user-task-schedule";

const deliverySchema = z.array(z.enum(["in_app", "email"])).min(1);

const scheduleInputSchema = z.object({
  preset: z.enum(["daily", "weekly", "monthly"]).optional(),
  cron: z.string().trim().min(5).max(120).optional(),
  rrule: z.string().trim().min(8).max(1024).optional()
});

const createSchema = z.object({
  name: z.string().trim().min(1).max(160),
  description: z.string().trim().max(500).optional(),
  type: z.enum(["prompt", "strategy", "scan", "report"]),
  prompt: z.string().min(4).max(8000),
  personaId: z.string().trim().max(64).optional(),
  portfolioId: z.string().trim().regex(/^[a-f\d]{24}$/i).optional(),
  enabled: z.boolean().optional(),
  schedule: scheduleInputSchema,
  delivery: deliverySchema.optional(),
  params: z
    .object({
      scope: z.enum(["portfolio", "watchlist", "all"]).optional(),
      riskProfile: z.enum(["conservative", "balanced", "aggressive"]).optional(),
      symbols: z.array(z.string().trim().min(1).max(16)).max(64).optional()
    })
    .optional(),
  timeZone: z.string().trim().max(64).optional()
});

function resolveScheduleFields(
  schedule: z.infer<typeof scheduleInputSchema>
): Pick<UserTask, "scheduleCron" | "scheduleRRule" | "scheduleDescription" | "schedulePreset"> {
  if (schedule.preset) {
    const scheduleCron = schedule.cron?.trim() || cronFromPreset(schedule.preset);
    const scheduleRRule = schedule.rrule?.trim();
    const vd = validateScheduleInput({
      scheduleCron,
      scheduleRRule: scheduleRRule || undefined
    });
    if (!vd.ok) {
      throw new Error(vd.message ?? "Invalid schedule");
    }
    const fakeTask: Pick<UserTask, "scheduleCron" | "scheduleRRule" | "scheduleDescription"> = {
      scheduleCron,
      scheduleRRule,
      scheduleDescription: undefined
    };
    return {
      scheduleCron,
      scheduleRRule,
      scheduleDescription: describeUserTaskSchedule(fakeTask),
      schedulePreset: schedule.preset
    };
  }
  const scheduleCron = schedule.cron?.trim();
  const scheduleRRule = schedule.rrule?.trim();
  const vd = validateScheduleInput({
    scheduleCron,
    scheduleRRule
  });
  if (!vd.ok) {
    throw new Error(vd.message ?? "Invalid schedule");
  }
  const fakeTask: Pick<UserTask, "scheduleCron" | "scheduleRRule" | "scheduleDescription"> = {
    scheduleCron,
    scheduleRRule,
    scheduleDescription: undefined
  };
  return {
    scheduleCron,
    scheduleRRule,
    scheduleDescription: describeUserTaskSchedule(fakeTask),
    schedulePreset: null
  };
}

export async function GET(request: Request) {
  const session = await requireApprovedAppUserSession();
  if (session instanceof NextResponse) {
    return session;
  }
  if (!ObjectId.isValid(session.tenantId) || !ObjectId.isValid(session.userId)) {
    return NextResponse.json({ error: "Invalid session scope" }, { status: 400 });
  }
  const tenantId = new ObjectId(session.tenantId);
  const userId = new ObjectId(session.userId);
  const url = new URL(request.url);
  const portfolioId = url.searchParams.get("portfolioId");

  const rows = await listUserTasksForUser({
    tenantId,
    userId,
    portfolioIdHex: portfolioId && /^[a-f\d]{24}$/i.test(portfolioId) ? portfolioId : undefined
  });
  return NextResponse.json({ data: rows.map(serializeUserTask) });
}

export async function POST(request: Request) {
  const session = await requireApprovedAppUserSession();
  if (session instanceof NextResponse) {
    return session;
  }
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

  const parsed = createSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid payload", details: parsed.error.flatten() }, { status: 400 });
  }

  const existingCount = await countUserTasksForUser({ tenantId, userId });
  if (existingCount >= MAX_USER_TASKS_PER_USER) {
    return NextResponse.json(
      { error: `Task limit reached (${MAX_USER_TASKS_PER_USER} tasks per user).`, code: "user_task_cap" },
      { status: 409 }
    );
  }

  let portfolioOid: ObjectId | null | undefined;
  if (parsed.data.portfolioId) {
    const p = await getPortfolioByIdForSessionUser({
      userId: session.userId,
      tenantId: session.tenantId,
      portfolioId: parsed.data.portfolioId
    });
    if (!p?._id) {
      return NextResponse.json({ error: "Portfolio not found", code: "portfolio_not_found" }, { status: 404 });
    }
    portfolioOid = p._id;
  }

  let scheduleFields: ReturnType<typeof resolveScheduleFields>;
  try {
    scheduleFields = resolveScheduleFields(parsed.data.schedule);
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Invalid schedule" },
      { status: 400 }
    );
  }

  const delivery = (parsed.data.delivery ?? ["in_app"]) as UserTaskDeliveryChannel[];
  const now = new Date();
  const taskDoc: UserTask = {
    tenantId,
    userId,
    portfolioId: portfolioOid ?? null,
    name: parsed.data.name.trim(),
    ...(parsed.data.description?.trim() ? { description: parsed.data.description.trim() } : {}),
    type: parsed.data.type,
    prompt: parsed.data.prompt.trim(),
    personaId: parsed.data.personaId?.trim() || null,
    ...scheduleFields,
    timeZone: parsed.data.timeZone?.trim(),
    enabled: parsed.data.enabled !== false,
    delivery,
    ...(parsed.data.params ? { params: parsed.data.params } : {}),
    nextRunAt: resolveInitialNextRunAt({
      scheduleCron: scheduleFields.scheduleCron,
      scheduleRRule: scheduleFields.scheduleRRule
    }),
    createdAt: now,
    updatedAt: now,
    createdByUserId: userId,
    updatedByUserId: userId
  };

  const created = await insertUserTask(taskDoc);
  return NextResponse.json({ data: serializeUserTask(created) }, { status: 201 });
}
