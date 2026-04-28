import { NextResponse } from "next/server";
import { z } from "zod";

import { requireAdminSession } from "@/lib/api-auth";
import {
    deleteMarketingTemplate,
    getMarketingTemplateById,
    updateMarketingTemplate
} from "@/modules/marketing/repository";
import { MARKETING_PLATFORMS } from "@/modules/marketing/types";

type RouteContext = { params: Promise<{ templateId: string }> };

const marketingPlatformSchema = z.enum(MARKETING_PLATFORMS);
const updateTemplateSchema = z
  .object({
    name: z.string().trim().min(1).max(200).optional(),
    platforms: z.array(marketingPlatformSchema).min(1).optional(),
    contentTemplate: z.string().trim().min(1).max(5000).optional(),
    defaultUtm: z
      .object({
        utm_source: z.string().trim().min(1),
        utm_campaign: z.string().trim().min(1),
        utm_medium: z.string().trim().optional(),
        utm_content: z.string().trim().optional(),
        utm_term: z.string().trim().optional()
      })
      .optional(),
    estimatedEngagement: z.enum(["low", "medium", "high"]).nullable().optional()
  })
  .refine(
    (v) =>
      v.name !== undefined ||
      v.platforms !== undefined ||
      v.contentTemplate !== undefined ||
      v.defaultUtm !== undefined ||
      v.estimatedEngagement !== undefined,
    { message: "At least one field is required" }
  );

function serializeTemplate(template: NonNullable<Awaited<ReturnType<typeof getMarketingTemplateById>>>) {
  return {
    _id: template._id?.toHexString(),
    slug: template.slug,
    name: template.name,
    platforms: template.platforms,
    contentTemplate: template.contentTemplate,
    defaultUtm: template.defaultUtm,
    disclaimerMode: template.disclaimerMode,
    estimatedEngagement: template.estimatedEngagement
  };
}

export async function PATCH(request: Request, context: RouteContext) {
  const session = await requireAdminSession();
  if (session instanceof NextResponse) {
    return session;
  }

  const { templateId } = await context.params;
  const existing = await getMarketingTemplateById(templateId);
  if (!existing) {
    return NextResponse.json({ error: "Template not found" }, { status: 404 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const parsed = updateTemplateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid payload", details: parsed.error.flatten() }, { status: 400 });
  }

  const updated = await updateMarketingTemplate(templateId, parsed.data);
  if (!updated) {
    return NextResponse.json({ error: "Template not found" }, { status: 404 });
  }
  return NextResponse.json({ data: serializeTemplate(updated) });
}

export async function DELETE(_request: Request, context: RouteContext) {
  const session = await requireAdminSession();
  if (session instanceof NextResponse) {
    return session;
  }

  const { templateId } = await context.params;
  const removed = await deleteMarketingTemplate(templateId);
  if (!removed) {
    return NextResponse.json({ error: "Template not found" }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}
