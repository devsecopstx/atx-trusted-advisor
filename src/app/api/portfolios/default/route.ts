import { NextResponse } from "next/server";

import { requireAdminSession } from "@/lib/api-auth";
import { getDefaultPortfolio } from "@/modules/core-admin/repository";

export async function GET() {
  const session = await requireAdminSession();
  if (session instanceof NextResponse) {
    return session;
  }

  const portfolio = await getDefaultPortfolio(session.userId, {
    tenantId: session.tenantId
  });
  if (!portfolio) {
    return NextResponse.json({ error: "Default portfolio not found" }, { status: 404 });
  }

  return NextResponse.json({ data: portfolio });
}
