import { NextResponse } from "next/server";

import { requireGlobalAdminSession } from "@/lib/api-auth";
import { buildDataPlaneWriteHealthPayload } from "@/lib/data-plane-write-health";

export async function GET() {
  const session = await requireGlobalAdminSession();
  if (session instanceof NextResponse) {
    return session;
  }

  return NextResponse.json({ data: buildDataPlaneWriteHealthPayload() });
}
