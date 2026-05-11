import { ObjectId } from "mongodb";
import { NextResponse } from "next/server";

import { requireGlobalAdminSession } from "@/lib/api-auth";
import { getTenantByHexIdCached } from "@/lib/server-request-cache";
import { resolveTenantIdHexForGlobalAdminConsole } from "@/modules/identity/repository";
import { getTenantExportJobById } from "@/modules/platform/tenant-admin-export-repository";
import type { TenantExportArtifactKind } from "@/modules/platform/tenant-admin-export-types";

type RouteContext = {
  params: Promise<{ tenantId: string; jobId: string; kind: string }>;
};

const ALLOWED: ReadonlySet<string> = new Set(["live_spec_yaml", "bootstrap_audit_csv"]);

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

  const { tenantId, jobId, kind } = await context.params;
  const kindNorm = kind.trim();
  if (!ALLOWED.has(kindNorm)) {
    return NextResponse.json({ error: "Unknown artifact kind" }, { status: 400 });
  }

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
    tenantId: tenant._id
  });
  if (!job?._id || job.status !== "completed") {
    return NextResponse.json(
      { error: "Export job not ready", code: "export_not_ready" },
      { status: 409 }
    );
  }

  const artifact = job.artifacts?.find((a) => a.kind === (kindNorm as TenantExportArtifactKind));
  if (!artifact?.content) {
    return NextResponse.json({ error: "Artifact not found" }, { status: 404 });
  }

  const mime =
    kindNorm === "live_spec_yaml" ? "text/yaml; charset=utf-8" : "text/csv; charset=utf-8";
  const body = new Blob([artifact.content], { type: mime });

  return new NextResponse(body, {
    status: 200,
    headers: {
      "Content-Type": mime,
      "Content-Disposition": `attachment; filename="${artifact.filename.replace(/[^a-zA-Z0-9._-]+/g, "_")}"`
    }
  });
}
