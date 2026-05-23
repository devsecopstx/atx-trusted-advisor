import { NextResponse } from "next/server";

import { requireApprovedAppUserSession } from "@/lib/api-auth";
import { getTenantByHexIdCached } from "@/lib/server-request-cache";
import {
    credentialSecFeatureDisabledResponse,
    isCredentialSecFeatureEnabledForTenant
} from "@/modules/compliance/credential-sec-gate";
import {
    deleteFinraRegistration,
    serializeFinraRegistration,
    updateFinraRegistration
} from "@/modules/compliance/repository";
import { isAdvisorPlatformRole } from "@/modules/identity/authorization";

export const dynamic = "force-dynamic";

type RouteParams = { params: Promise<{ registrationId: string }> };

export async function PATCH(request: Request, { params }: RouteParams) {
  const session = await requireApprovedAppUserSession();
  if (session instanceof NextResponse) {
    return session;
  }
  if (!isAdvisorPlatformRole(session.roles)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const tenant = await getTenantByHexIdCached(session.tenantId);
  if (!isCredentialSecFeatureEnabledForTenant(tenant)) {
    return credentialSecFeatureDisabledResponse();
  }

  const { registrationId } = await params;

  let body: unknown = {};
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  }

  const result = await updateFinraRegistration({
    tenantId: session.tenantId,
    advisorUserId: session.userId,
    registrationId,
    email: session.email,
    body
  });

  if ("error" in result) {
    const status = result.error === "not_found" ? 404 : 400;
    return NextResponse.json({ error: result.error }, { status });
  }

  return NextResponse.json({ data: serializeFinraRegistration(result.registration) });
}

export async function DELETE(_request: Request, { params }: RouteParams) {
  const session = await requireApprovedAppUserSession();
  if (session instanceof NextResponse) {
    return session;
  }
  if (!isAdvisorPlatformRole(session.roles)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const tenant = await getTenantByHexIdCached(session.tenantId);
  if (!isCredentialSecFeatureEnabledForTenant(tenant)) {
    return credentialSecFeatureDisabledResponse();
  }

  const { registrationId } = await params;

  const result = await deleteFinraRegistration({
    tenantId: session.tenantId,
    advisorUserId: session.userId,
    registrationId,
    email: session.email
  });

  if ("error" in result) {
    const status = result.error === "not_found" ? 404 : 400;
    return NextResponse.json({ error: result.error }, { status });
  }

  return NextResponse.json({ data: { ok: true } });
}
