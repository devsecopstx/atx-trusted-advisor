import { NextResponse } from "next/server";

import { requireAdminSession, requireAdminTenantIdHex } from "@/lib/api-auth";
import { createAuditEvent } from "@/modules/audit/repository";
import {
    createEmailTemplate,
    EmailTemplateConflictError,
    listEmailTemplates
} from "@/modules/email-templates/email-templates-repository";
import { serializeEmailTemplate } from "@/modules/email-templates/serialize";
import {
    createEmailTemplatePayloadSchema
} from "@/modules/email-templates/types";

export async function GET(request: Request) {
  const session = await requireAdminSession();
  if (session instanceof NextResponse) {
    return session;
  }
  const tenantIdHex = await requireAdminTenantIdHex(session);
  if (tenantIdHex instanceof NextResponse) {
    return tenantIdHex;
  }
  const url = new URL(request.url);
  const includeGlobal = url.searchParams.get("includeGlobal") !== "false";
  const rows = await listEmailTemplates({
    tenantId: tenantIdHex,
    includeGlobalDefaults: includeGlobal
  });
  return NextResponse.json({ data: rows.map(serializeEmailTemplate) });
}

export async function POST(request: Request) {
  const session = await requireAdminSession();
  if (session instanceof NextResponse) {
    return session;
  }
  const body = await request.json().catch(() => null);
  if (body === null) {
    return NextResponse.json({ error: "Invalid JSON payload" }, { status: 400 });
  }
  const parsed = createEmailTemplatePayloadSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid email template payload", details: parsed.error.flatten() },
      { status: 400 }
    );
  }
  try {
    const created = await createEmailTemplate(parsed.data);
    if (created._id) {
      await createAuditEvent({
        entityType: "email_template",
        entityId: created._id.toHexString(),
        action: "created",
        actor: {
          userId: session.userId,
          email: session.email,
          username: session.username
        },
        details: {
          slug: created.slug,
          tenantId: created.tenantId?.toHexString() ?? null,
          version: created.version
        }
      });
    }
    return NextResponse.json({ data: serializeEmailTemplate(created) }, { status: 201 });
  } catch (error) {
    if (error instanceof EmailTemplateConflictError) {
      return NextResponse.json({ error: error.message, code: error.code }, { status: 409 });
    }
    throw error;
  }
}
