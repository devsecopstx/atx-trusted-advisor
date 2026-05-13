import { ObjectId } from "mongodb";
import { NextResponse } from "next/server";

import { requireAdminSession, requireAdminTenantIdHex } from "@/lib/api-auth";
import { createAuditEvent } from "@/modules/audit/repository";
import { adminGetPortfolioById } from "@/modules/core-admin/repository";
import { resolveEffectiveEmailTemplate } from "@/modules/email-templates/email-template-resolver";
import { findActiveEmailTemplate } from "@/modules/email-templates/email-templates-repository";
import {
    listPortfolioEmailPreferences,
    upsertPortfolioEmailPreference
} from "@/modules/email-templates/portfolio-email-preferences-repository";
import {
    serializeEmailTemplate,
    serializePortfolioEmailPreference
} from "@/modules/email-templates/serialize";
import {
    EMAIL_TEMPLATE_SLUGS,
    updatePortfolioEmailPreferencePayloadSchema
} from "@/modules/email-templates/types";

type RouteContext = {
  params: Promise<{ portfolioId: string }>;
};

export async function GET(_request: Request, context: RouteContext) {
  const session = await requireAdminSession();
  if (session instanceof NextResponse) {
    return session;
  }
  const tenantIdHex = await requireAdminTenantIdHex(session);
  if (tenantIdHex instanceof NextResponse) {
    return tenantIdHex;
  }
  const { portfolioId } = await context.params;
  if (!ObjectId.isValid(portfolioId)) {
    return NextResponse.json({ error: "Invalid portfolioId" }, { status: 400 });
  }
  const portfolio = await adminGetPortfolioById(portfolioId);
  if (!portfolio?._id) {
    return NextResponse.json({ error: "Portfolio not found" }, { status: 404 });
  }
  if (portfolio.tenantId && portfolio.tenantId.toHexString() !== tenantIdHex) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const preferences = await listPortfolioEmailPreferences({
    tenantId: tenantIdHex,
    portfolioId
  });

  const resolvedBySlug = await Promise.all(
    EMAIL_TEMPLATE_SLUGS.map(async (slug) => {
      const resolved = await resolveEffectiveEmailTemplate({
        slug,
        tenantId: tenantIdHex,
        portfolioId
      });
      const fallbackTemplate = resolved
        ? null
        : await findActiveEmailTemplate({ slug, tenantId: tenantIdHex });
      const template = resolved ? resolved.template : fallbackTemplate;
      return {
        slug,
        effective: resolved
          ? {
              subject: resolved.subject,
              body: resolved.body,
              cadence: resolved.cadence,
              enabled: resolved.enabled,
              sources: resolved.sources
            }
          : null,
        template: template ? serializeEmailTemplate(template) : null
      };
    })
  );

  return NextResponse.json({
    data: {
      portfolioId,
      tenantId: tenantIdHex,
      preferences: preferences.map(serializePortfolioEmailPreference),
      templates: resolvedBySlug
    }
  });
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
  const { portfolioId } = await context.params;
  if (!ObjectId.isValid(portfolioId)) {
    return NextResponse.json({ error: "Invalid portfolioId" }, { status: 400 });
  }
  const portfolio = await adminGetPortfolioById(portfolioId);
  if (!portfolio?._id) {
    return NextResponse.json({ error: "Portfolio not found" }, { status: 404 });
  }
  if (portfolio.tenantId && portfolio.tenantId.toHexString() !== tenantIdHex) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  if (body === null) {
    return NextResponse.json({ error: "Invalid JSON payload" }, { status: 400 });
  }
  const parsed = updatePortfolioEmailPreferencePayloadSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid email preference payload", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const updated = await upsertPortfolioEmailPreference({
    tenantId: tenantIdHex,
    portfolioId,
    patch: parsed.data
  });

  if (updated._id) {
    await createAuditEvent({
      entityType: "portfolio_email_preference",
      entityId: updated._id.toHexString(),
      action: "updated",
      actor: {
        userId: session.userId,
        email: session.email,
        username: session.username
      },
      details: {
        portfolioId,
        templateSlug: updated.templateSlug,
        changedFields: Object.keys(parsed.data)
      }
    });
  }

  return NextResponse.json({ data: serializePortfolioEmailPreference(updated) });
}
