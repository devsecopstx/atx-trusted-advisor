import { NextResponse } from "next/server";

import { requireAdminSession } from "@/lib/api-auth";
import { proxyRequestToBackend } from "@/lib/backend-bff";
import { listTaskRuns } from "@/modules/core-admin/repository";

export async function GET(request: Request) {
  const proxied = await proxyRequestToBackend(request);
  if (proxied) {
    return proxied;
  }

  const session = await requireAdminSession();
  if (session instanceof NextResponse) {
    return session;
  }

  const runs = await listTaskRuns({
    tenantId: session.tenantId
  });
  return NextResponse.json({ data: runs });
}
