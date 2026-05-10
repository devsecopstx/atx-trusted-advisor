import { NextResponse } from "next/server";
import { z } from "zod";

import { requireGlobalAdminSession } from "@/lib/api-auth";
import { TENANT_UX_FAIL_CLOSED_DRILL_COOKIE } from "@/modules/platform/tenant-ux-flags";

const bodySchema = z.object({
  enabled: z.boolean()
});

function envFailClosedEnabled(raw = process.env.TENANT_UX_POLICY_FAIL_CLOSED): boolean {
  if (!raw) {
    return false;
  }
  const normalized = raw.trim().toLowerCase();
  return normalized === "1" || normalized === "true" || normalized === "yes";
}

export async function GET(request: Request) {
  const session = await requireGlobalAdminSession();
  if (session instanceof NextResponse) {
    return session;
  }
  const cookieHeader = request.headers.get("cookie") ?? "";
  const enabled = new RegExp(`${TENANT_UX_FAIL_CLOSED_DRILL_COOKIE}=(1|true|yes)`, "i").test(
    cookieHeader
  );
  return NextResponse.json({
    data: {
      enabled,
      envEnabled: envFailClosedEnabled()
    }
  });
}

export async function POST(request: Request) {
  const session = await requireGlobalAdminSession();
  if (session instanceof NextResponse) {
    return session;
  }
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid request payload", details: parsed.error.flatten() },
      { status: 400 }
    );
  }
  const response = NextResponse.json({
    data: {
      enabled: parsed.data.enabled,
      envEnabled: envFailClosedEnabled()
    }
  });
  response.cookies.set(TENANT_UX_FAIL_CLOSED_DRILL_COOKIE, parsed.data.enabled ? "1" : "0", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 12
  });
  return response;
}
