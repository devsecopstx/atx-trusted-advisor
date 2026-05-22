import { NextResponse } from "next/server";

import { requireApprovedAppUserSession } from "@/lib/api-auth";
import { getTenantByHexIdCached } from "@/lib/server-request-cache";
import { buildAdvisorComplianceReportExport } from "@/modules/compliance/compliance-report-export";

export const dynamic = "force-dynamic";

function safeExportFilenameStem(input: string): string {
  const stem = input.trim().toLowerCase().replace(/[^a-z0-9._-]+/g, "-").replace(/^-+|-+$/g, "");
  return stem.length > 0 ? stem.slice(0, 48) : "advisor";
}

function jsonAttachmentResponse(payload: unknown, filename: string): NextResponse {
  const body = JSON.stringify(payload, null, 2);
  return new NextResponse(body, {
    status: 200,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store"
    }
  });
}

export async function GET() {
  const session = await requireApprovedAppUserSession();
  if (session instanceof NextResponse) {
    return session;
  }

  const tenant = await getTenantByHexIdCached(session.tenantId);
  const report = await buildAdvisorComplianceReportExport({
    userId: session.userId,
    tenantId: session.tenantId,
    email: session.email,
    roles: session.roles,
    tenant
  });

  if ("error" in report) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const emailStem = safeExportFilenameStem(session.email.split("@")[0] ?? session.userId);
  const dateStem = report.exportedAt.slice(0, 10);
  return jsonAttachmentResponse(report, `advisor-compliance-report-${emailStem}-${dateStem}.json`);
}
