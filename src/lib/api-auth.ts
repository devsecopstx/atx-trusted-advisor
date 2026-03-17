import { NextResponse } from "next/server";

import { requireSessionUser, type SessionUser } from "@/lib/auth";

export async function requireAdminSession(): Promise<SessionUser | NextResponse> {
  const session = await requireSessionUser();
  if (session instanceof NextResponse) {
    return session;
  }

  if (!session.roles.includes("global_admin")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  return session;
}

