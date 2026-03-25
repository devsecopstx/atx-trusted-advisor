import { NextResponse } from "next/server";
import { z } from "zod";

import { serializeScheduledTaskForJson } from "@/lib/admin-scheduled-task-serialize";
import { requireAdminSession } from "@/lib/api-auth";
import { proxyRequestToBackend } from "@/lib/backend-bff";
import {
    adminGetPortfolioById,
    createScheduledTask,
    listScheduledTasks
} from "@/modules/core-admin/repository";

type RouteContext = {
  params: Promise<{ portfolioId: string }>;
};

const createTaskSchema = z.object({
  name: z.string().min(1).max(200),
  category: z.enum(["sync-broker", "rebalance", "compliance", "notifications", "user-history"]),
  scheduleCron: z.string().min(5).max(128),
  enabled: z.boolean().optional(),
  lastRunAt: z.coerce.date().optional(),
  nextRunAt: z.coerce.date().optional()
});

export async function GET(request: Request, context: RouteContext) {
  const proxied = await proxyRequestToBackend(request);
  if (proxied) {
    return proxied;
  }

  const session = await requireAdminSession();
  if (session instanceof NextResponse) {
    return session;
  }

  const { portfolioId } = await context.params;
  const portfolio = await adminGetPortfolioById(portfolioId);
  if (!portfolio?._id) {
    return NextResponse.json({ error: "Portfolio not found" }, { status: 404 });
  }

  const tasks = await listScheduledTasks({
    tenantId: session.tenantId,
    portfolioId
  });
  return NextResponse.json({ data: tasks.map(serializeScheduledTaskForJson) });
}

export async function POST(request: Request, context: RouteContext) {
  const proxied = await proxyRequestToBackend(request);
  if (proxied) {
    return proxied;
  }

  const session = await requireAdminSession();
  if (session instanceof NextResponse) {
    return session;
  }

  const { portfolioId } = await context.params;
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

  const parsed = createTaskSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid request payload", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const created = await createScheduledTask({
    name: parsed.data.name,
    category: parsed.data.category,
    scheduleCron: parsed.data.scheduleCron,
    enabled: parsed.data.enabled ?? true,
    lastRunAt: parsed.data.lastRunAt,
    nextRunAt: parsed.data.nextRunAt,
    tenantId: session.tenantId,
    portfolioId
  });
  return NextResponse.json({ data: serializeScheduledTaskForJson(created) }, { status: 201 });
}
