import { NextResponse } from "next/server";
import { z } from "zod";

import { requireAdminSession } from "@/lib/api-auth";
import { serializeScheduledTaskForJson } from "@/lib/admin-scheduled-task-serialize";
import { adminGetPortfolioById, deleteScheduledTask, updateScheduledTask } from "@/modules/core-admin/repository";

type RouteContext = {
  params: Promise<{ portfolioId: string; taskId: string }>;
};

const patchTaskSchema = z
  .object({
    name: z.string().trim().min(1).max(200).optional(),
    category: z.enum(["sync-broker", "rebalance", "compliance", "notifications", "user-history"]).optional(),
    scheduleCron: z.string().trim().min(5).max(128).optional(),
    enabled: z.boolean().optional(),
    nextRunAt: z.union([z.coerce.date(), z.null()]).optional()
  })
  .refine(
    (d) =>
      d.name !== undefined ||
      d.category !== undefined ||
      d.scheduleCron !== undefined ||
      d.enabled !== undefined ||
      d.nextRunAt !== undefined,
    { message: "At least one field is required" }
  );

export async function PATCH(request: Request, context: RouteContext) {
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

  const updated = await updateScheduledTask({
    taskId,
    tenantId: session.tenantId,
    expectedPortfolioId: portfolioId,
    name: parsed.data.name,
    category: parsed.data.category,
    scheduleCron: parsed.data.scheduleCron,
    enabled: parsed.data.enabled,
    nextRunAt: parsed.data.nextRunAt === null ? null : parsed.data.nextRunAt
  });

  if (!updated) {
    return NextResponse.json({ error: "Task not found" }, { status: 404 });
  }

  return NextResponse.json({ data: serializeScheduledTaskForJson(updated) });
}

export async function DELETE(_request: Request, context: RouteContext) {
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
