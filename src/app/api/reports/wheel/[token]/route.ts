import { NextResponse } from "next/server";

import { getWheelSharedReportByToken } from "@/modules/xoptions/wheel-report-repository";

export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{ token: string }>;
};

export async function GET(_request: Request, context: RouteContext) {
  const { token } = await context.params;
  const report = await getWheelSharedReportByToken(token.trim());
  if (!report) {
    return NextResponse.json({ error: "Report not found" }, { status: 404 });
  }
  return NextResponse.json({
    data: {
      generatedByName: report.generatedByName,
      createdAt: report.createdAt.toISOString(),
      expiresAt: report.expiresAt.toISOString(),
      accessCount: report.accessCount,
      report: report.reportPayload
    }
  });
}
