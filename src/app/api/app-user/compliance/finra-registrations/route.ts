import { NextResponse } from "next/server";

import { requireApprovedAppUserSession } from "@/lib/api-auth";
import {
    createFinraRegistration,
    listFinraRegistrationsForAdvisor,
    serializeFinraRegistration
} from "@/modules/compliance/repository";
import { isAdvisorPlatformRole } from "@/modules/identity/authorization";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await requireApprovedAppUserSession();
  if (session instanceof NextResponse) {
    return session;
  }
  if (!isAdvisorPlatformRole(session.roles)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const rows = await listFinraRegistrationsForAdvisor({
    tenantId: session.tenantId,
    advisorUserId: session.userId
  });

  return NextResponse.json({
    data: rows.map(serializeFinraRegistration)
  });
}

export async function POST(request: Request) {
  const session = await requireApprovedAppUserSession();
  if (session instanceof NextResponse) {
    return session;
  }
  if (!isAdvisorPlatformRole(session.roles)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let body: unknown = {};
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  }

  const result = await createFinraRegistration({
    tenantId: session.tenantId,
    advisorUserId: session.userId,
    email: session.email,
    body
  });

  if ("error" in result) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }

  return NextResponse.json({ data: serializeFinraRegistration(result.registration) }, { status: 201 });
}
