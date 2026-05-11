import { ObjectId } from "mongodb";
import { NextResponse } from "next/server";

import { serializeTenantExportJob } from "@/lib/admin-tenant-export-json";
import { requireGlobalAdminSession } from "@/lib/api-auth";
import { getTenantByHexIdCached } from "@/lib/server-request-cache";
import { resolveTenantIdHexForGlobalAdminConsole } from "@/modules/identity/repository";
import { getTenantExportJobById } from "@/modules/platform/tenant-admin-export-repository";

type RouteContext = {
  params: Promise<{ tenantId: string; jobId: string }>;
};

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

  const { tenantId, jobId } = await context.params;
  const tenant = await loadTenantForRoute(tenantId, session.tenantId);
  if (!tenant?._id) {
    return NextResponse.json({ error: "Tenant not found" }, { status: 404 });
  }

  const jid = jobId.trim();
  if (!ObjectId.isValid(jid)) {
    return NextResponse.json({ error: "Invalid job id" }, { status: 400 });
  }

  const job = await getTenantExportJobById({
    jobId: new ObjectId(jid),
    tenantId: tenant._id,
    omitArtifactBodies: true
  });
  if (!job?._id) {
    return NextResponse.json({ error: "Export job not found" }, { status: 404 });
  }

  return NextResponse.json({ data: serializeTenantExportJob(job) });
}
