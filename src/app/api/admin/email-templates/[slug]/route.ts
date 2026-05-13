import { NextResponse } from "next/server";

import { requireAdminSession, requireAdminTenantIdHex } from "@/lib/api-auth";
import { createAuditEvent } from "@/modules/audit/repository";
import {
    deleteEmailTemplate,
    getEmailTemplateBySlug,
    updateEmailTemplate
} from "@/modules/email-templates/email-templates-repository";
import { serializeEmailTemplate } from "@/modules/email-templates/serialize";
import {
    isEmailTemplateSlug,
    updateEmailTemplatePayloadSchema
} from "@/modules/email-templates/types";

type RouteContext = {
  params: Promise<{ slug: string }>;
};

export async function GET(request: Request, context: RouteContext) {
  const session = await requireAdminSession();
  if (session instanceof NextResponse) {
    return session;
  }
  const tenantIdHex = await requireAdminTenantIdHex(session);
  if (tenantIdHex instanceof NextResponse) {
    return tenantIdHex;
  }
  const { slug } = await context.params;
  if (!isEmailTemplateSlug(slug)) {
    return NextResponse.json({ error: "Unknown email template slug" }, { status: 404 });
  }
  const url = new URL(request.url);
  const scope = url.searchParams.get("scope");
  const tenantScoped = scope === "global" ? null : tenantIdHex;
  const row = await getEmailTemplateBySlug({ slug, tenantId: tenantScoped });
  if (!row) {
    return NextResponse.json({ error: "Email template not found" }, { status: 404 });
  }
  return NextResponse.json({ data: serializeEmailTemplate(row) });
}

export async function PATCH(request: Request, context: RouteContext) {
  const session = await requireAdminSession();
  if (session instanceof NextResponse) {
    return session;
  }
  const tenantIdHex = await requireAdminTenantIdHex(session);
  if (tenantIdHex instanceof NextResponse) {
    return tenantIdHex;
  }
  const { slug } = await context.params;
  if (!isEmailTemplateSlug(slug)) {
    return NextResponse.json({ error: "Unknown email template slug" }, { status: 404 });
  }
  const body = await request.json().catch(() => null);
  if (body === null) {
    return NextResponse.json({ error: "Invalid JSON payload" }, { status: 400 });
  }
  const parsed = updateEmailTemplatePayloadSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid email template payload", details: parsed.error.flatten() },
      { status: 400 }
    );
  }
  const url = new URL(request.url);
  const scope = url.searchParams.get("scope");
  const tenantScoped = scope === "global" ? null : tenantIdHex;
  const updated = await updateEmailTemplate({
    slug,
    tenantId: tenantScoped,
    patch: parsed.data
  });
  if (!updated) {
    return NextResponse.json({ error: "Email template not found" }, { status: 404 });
  }
  if (updated._id) {
    await createAuditEvent({
      entityType: "email_template",
      entityId: updated._id.toHexString(),
      action: "updated",
      actor: {
        userId: session.userId,
        email: session.email,
        username: session.username
      },
      details: {
        slug: updated.slug,
        tenantId: updated.tenantId?.toHexString() ?? null,
        changedFields: Object.keys(parsed.data)
      }
    });
  }
  return NextResponse.json({ data: serializeEmailTemplate(updated) });
}

export async function DELETE(request: Request, context: RouteContext) {
  const session = await requireAdminSession();
  if (session instanceof NextResponse) {
    return session;
  }
  const tenantIdHex = await requireAdminTenantIdHex(session);
  if (tenantIdHex instanceof NextResponse) {
    return tenantIdHex;
  }
  const { slug } = await context.params;
  if (!isEmailTemplateSlug(slug)) {
    return NextResponse.json({ error: "Unknown email template slug" }, { status: 404 });
  }
  const url = new URL(request.url);
  const scope = url.searchParams.get("scope");
  const tenantScoped = scope === "global" ? null : tenantIdHex;
  const existing = await getEmailTemplateBySlug({ slug, tenantId: tenantScoped });
  if (!existing) {
    return NextResponse.json({ error: "Email template not found" }, { status: 404 });
  }
  const ok = await deleteEmailTemplate({ slug, tenantId: tenantScoped });
  if (!ok) {
    return NextResponse.json({ error: "Email template not found" }, { status: 404 });
  }
  if (existing._id) {
    await createAuditEvent({
      entityType: "email_template",
      entityId: existing._id.toHexString(),
      action: "deleted",
      actor: {
        userId: session.userId,
        email: session.email,
        username: session.username
      },
      details: {
        slug: existing.slug,
        tenantId: existing.tenantId?.toHexString() ?? null
      }
    });
  }
  return NextResponse.json({ ok: true });
}
