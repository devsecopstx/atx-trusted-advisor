import { NextResponse } from "next/server";

import { requireAdminSession, requireAdminTenantIdHex } from "@/lib/api-auth";
import { proxyAdminScheduledTasksRequestToBackend } from "@/lib/backend-bff";
import { listTaskRuns } from "@/modules/core-admin/repository";

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

  const runs = await listTaskRuns({
    tenantId: tenantIdHex
  });
  return NextResponse.json({ data: runs });
}
