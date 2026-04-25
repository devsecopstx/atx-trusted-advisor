import { NextResponse } from "next/server";

import { getOptionsScanSharedReportForPublicView } from "@/modules/xchat/options-scan-share-repository";

type RouteContext = {
  params: Promise<{ token: string }>;
};

export async function GET(_request: Request, context: RouteContext) {
  const { token } = await context.params;
  const cleanToken = token.trim();
  if (!cleanToken) {
    return NextResponse.json({ error: "Token is required" }, { status: 400 });
  }

  const report = await getOptionsScanSharedReportForPublicView(cleanToken);
  if (!report) {
    return NextResponse.json({ error: "Report not found or expired" }, { status: 404 });
  }

  return NextResponse.json({
    data: {
      scanData: report.scanData,
      createdAt: report.createdAt.toISOString(),
      expiresAt: report.expiresAt.toISOString(),
      accessCount: report.accessCount
    }
  });
}
