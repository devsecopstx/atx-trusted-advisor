import { NextResponse } from "next/server";
import { z } from "zod";

import { serializeAdminTaskRunForJson } from "@/lib/admin-scheduled-task-serialize";
import { resolveTaskRunListWindowQuery } from "@/lib/admin-task-run-window";
import { requireAdminSession, requireAdminTenantIdHex } from "@/lib/api-auth";
import { proxyAdminScheduledTasksRequestToBackend } from "@/lib/backend-bff";
import { listTaskRuns } from "@/modules/core-admin/repository";

const taskRunsQuerySchema = z.object({
  window: z.enum(["today", "30d"]).default("today"),
  limit: z.coerce.number().int().min(1).max(500).optional()
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

  const tenantIdHex = await requireAdminTenantIdHex(session);
  if (tenantIdHex instanceof NextResponse) {
    return tenantIdHex;
  }

  const url = new URL(request.url);
  const parsed = taskRunsQuerySchema.safeParse({
    window: url.searchParams.get("window") ?? undefined,
    limit: url.searchParams.get("limit") ?? undefined
  });
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid query", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const { window, limit: limitParam } = parsed.data;
  const { startedAtMin, startedAtMaxExclusive, defaultLimit } = resolveTaskRunListWindowQuery(window);
  const limit = limitParam ?? defaultLimit;

  const runs = await listTaskRuns({
    tenantId: tenantIdHex,
    allTenants: true,
    startedAtMin,
    startedAtMaxExclusive,
    limit
  });
  return NextResponse.json({
    data: runs.map(serializeAdminTaskRunForJson),
    meta: {
      window,
      startedAtMin: startedAtMin.toISOString(),
      startedAtMaxExclusive: startedAtMaxExclusive?.toISOString() ?? null,
      limit
    }
  });
}
