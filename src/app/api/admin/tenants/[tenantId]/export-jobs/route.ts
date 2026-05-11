import { ObjectId } from "mongodb";
import { NextResponse } from "next/server";
import { z } from "zod";

import { serializeTenantExportJob } from "@/lib/admin-tenant-export-json";
import { requireGlobalAdminSession } from "@/lib/api-auth";
import { getTenantByHexIdCached } from "@/lib/server-request-cache";
import { resolveTenantIdHexForGlobalAdminConsole } from "@/modules/identity/repository";
import {
    ensureTenantExportJobIndexes,
    insertTenantExportJob,
    listTenantExportJobsForTenant
} from "@/modules/platform/tenant-admin-export-repository";
import type { TenantExportArtifactKind } from "@/modules/platform/tenant-admin-export-types";

type RouteContext = {
  params: Promise<{ tenantId: string }>;
};

const exportKindSchema = z.enum(["live_spec_yaml", "bootstrap_audit_csv"]);

const postSchema = z.object({
  kinds: z.array(exportKindSchema).min(1)
});

async function loadTenantForRoute(urlTenantId: string, sessionTenantId: string) {
  const url = urlTenantId.trim();
  let tenant = await getTenantByHexIdCached(url);
  if (tenant?._id) {
    return tenant;
  }
  if (url === sessionTenantId.trim()) {
    const resolved = await resolveTenantIdHexForGlobalAdminConsole(sessionTenantId);
    if (resolved) {
      tenant = await getTenantByHexIdCached(resolved);
    }
  }
  return tenant?._id ? tenant : null;
}

export async function GET(_request: Request, context: RouteContext) {
  const session = await requireGlobalAdminSession();
  if (session instanceof NextResponse) {
    return session;
  }

  const { tenantId } = await context.params;
  const tenant = await loadTenantForRoute(tenantId, session.tenantId);
  if (!tenant?._id) {
    return NextResponse.json({ error: "Tenant not found" }, { status: 404 });
  }

  await ensureTenantExportJobIndexes();
  const jobs = await listTenantExportJobsForTenant({ tenantId: tenant._id, limit: 30 });
  return NextResponse.json({
    data: {
      tenantId: tenant._id.toHexString(),
      jobs: jobs.map(serializeTenantExportJob)
    }
  });
}

export async function POST(request: Request, context: RouteContext) {
  const session = await requireGlobalAdminSession();
  if (session instanceof NextResponse) {
    return session;
  }

  const { tenantId } = await context.params;
  const tenant = await loadTenantForRoute(tenantId, session.tenantId);
  if (!tenant?._id) {
    return NextResponse.json({ error: "Tenant not found" }, { status: 404 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = postSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid payload", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const kinds: TenantExportArtifactKind[] = [...new Set(parsed.data.kinds)];

  await ensureTenantExportJobIndexes();
  const job = await insertTenantExportJob({
    tenantId: tenant._id,
    kinds,
    createdByUserId: new ObjectId(session.userId)
  });

  return NextResponse.json(
    {
      data: serializeTenantExportJob(job),
      message:
        "Export queued. Run the tenant_export_worker scheduled task (Admin → Tasks) or wait for cron to drain the queue."
    },
    { status: 201 }
  );
}
