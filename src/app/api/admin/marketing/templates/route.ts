import { NextResponse } from "next/server";
import { z } from "zod";

import { requireAdminSession } from "@/lib/api-auth";
import { createMarketingTemplate, listMarketingTemplates } from "@/modules/marketing/repository";
import { MARKETING_PLATFORMS } from "@/modules/marketing/types";

const marketingPlatformSchema = z.enum(MARKETING_PLATFORMS);

const createTemplateSchema = z.object({
  name: z.string().trim().min(1).max(200),
  platforms: z.array(marketingPlatformSchema).min(1),
  contentTemplate: z.string().trim().min(1).max(5000),
  defaultUtm: z.object({
    utm_source: z.string().trim().min(1),
    utm_campaign: z.string().trim().min(1),
    utm_medium: z.string().trim().optional(),
    utm_content: z.string().trim().optional(),
    utm_term: z.string().trim().optional()
  }),
  estimatedEngagement: z.enum(["low", "medium", "high"]).optional()
});

function serializeTemplate(template: Awaited<ReturnType<typeof listMarketingTemplates>>[number]) {
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

export async function GET() {
  const session = await requireAdminSession();
  if (session instanceof NextResponse) {
    return session;
  }

  const templates = await listMarketingTemplates();
  return NextResponse.json({ data: templates.map(serializeTemplate) });
}

export async function POST(request: Request) {
  const session = await requireAdminSession();
  if (session instanceof NextResponse) {
    return session;
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const parsed = createTemplateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid payload", details: parsed.error.flatten() }, { status: 400 });
  }

  const created = await createMarketingTemplate({
    name: parsed.data.name,
    platforms: parsed.data.platforms,
    contentTemplate: parsed.data.contentTemplate,
    defaultUtm: parsed.data.defaultUtm,
    estimatedEngagement: parsed.data.estimatedEngagement
  });
  return NextResponse.json({ data: serializeTemplate(created) }, { status: 201 });
}
