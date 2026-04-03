import { NextResponse } from "next/server";

import { requireAdminSession } from "@/lib/api-auth";
import { proxyAdminUsersRequestToBackend } from "@/lib/backend-bff";
import { listApprovedUsers } from "@/modules/core-admin/repository";

export async function GET(request: Request) {
  const proxied = await proxyAdminUsersRequestToBackend(request);
  if (proxied) {
    return proxied;
  }

  const session = await requireAdminSession();
  if (session instanceof NextResponse) {
    return session;
  }

  const users = await listApprovedUsers(100, {
    tenantId: session.tenantId
  });
  return NextResponse.json({ data: users });
}
