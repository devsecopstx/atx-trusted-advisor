import { NextResponse } from "next/server";

import { requireAdminSession } from "@/lib/api-auth";
import { proxyAdminUsersRequestToBackend } from "@/lib/backend-bff";
import { listTenantRegisterForAdmin } from "@/modules/identity/repository";

export async function GET(request: Request) {
  const proxied = await proxyAdminUsersRequestToBackend(request);
  if (proxied) {
    return proxied;
  }

  const session = await requireAdminSession();
  if (session instanceof NextResponse) {
    return session;
  }

  const data = await listTenantRegisterForAdmin();
  return NextResponse.json({ data });
}
