import { NextResponse } from "next/server";
import { z } from "zod";

import { serializeAdminTaskRunForJson } from "@/lib/admin-scheduled-task-serialize";
import {
    pickAdminTenantLabel,
    resolveAdminTenantLabelsByHex
} from "@/lib/admin-scheduled-task-tenant-labels";
import { resolveTaskRunListWindowQuery } from "@/lib/admin-task-run-window";
import { requireAdminSession, requireAdminTenantIdHex } from "@/lib/api-auth";
import { proxyAdminScheduledTasksRequestToBackend } from "@/lib/backend-bff";
import { listTaskRuns } from "@/modules/core-admin/repository";

const taskRunsQuerySchema = z.object({
  window: z.enum(["today", "24h", "30d"]).default("today"),
  status: z.enum(["running", "success", "failed"]).optional(),
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
    status: url.searchParams.get("status") ?? undefined,
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
    status: parsed.data.status,
    startedAtMin,
    startedAtMaxExclusive,
    limit
  });
  const tenantLabels = await resolveAdminTenantLabelsByHex(
    runs.map((run) => run.tenantId?.toHexString())
  );
  return NextResponse.json({
    data: runs.map((run) => {
      const base = serializeAdminTaskRunForJson(run);
      const label = pickAdminTenantLabel(tenantLabels, base.tenantId);
      return {
        ...base,
        tenantName: label?.tenantName ?? null,
        tenantSlug: label?.tenantSlug ?? null
      };
    }),
    meta: {
      window,
      startedAtMin: startedAtMin.toISOString(),
      startedAtMaxExclusive: startedAtMaxExclusive?.toISOString() ?? null,
      limit
    }
  });
}
