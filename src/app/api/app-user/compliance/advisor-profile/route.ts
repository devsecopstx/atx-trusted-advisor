import { NextResponse } from "next/server";

import { requireApprovedAppUserSession } from "@/lib/api-auth";
import {
    getAdvisorComplianceProfileForUser,
    serializeAdvisorComplianceProfile,
    upsertAdvisorComplianceAcknowledgments
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

  const profile = await getAdvisorComplianceProfileForUser(session.userId);
  return NextResponse.json({ data: serializeAdvisorComplianceProfile(profile) });
}

export async function PUT(request: Request) {
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

  const result = await upsertAdvisorComplianceAcknowledgments({
    userId: session.userId,
    tenantId: session.tenantId,
    email: session.email,
    body
  });

  if ("error" in result) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }

  return NextResponse.json({ data: serializeAdvisorComplianceProfile(result.profile) });
}
