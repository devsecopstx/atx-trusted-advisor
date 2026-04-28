import { NextResponse } from "next/server";
import { z } from "zod";

import { requireAdminSession } from "@/lib/api-auth";
import { renderMarketingPost } from "@/modules/marketing/render";
import { getMarketingTemplateById } from "@/modules/marketing/repository";
import { MARKETING_PLATFORMS } from "@/modules/marketing/types";
import { generateMarketingMarkdownWithXchat } from "@/modules/marketing/xchat-markdown";

const marketingPlatformSchema = z.enum(MARKETING_PLATFORMS);

const previewRequestSchema = z.object({
  templateId: z.string().trim().optional(),
  customContent: z.string().trim().max(5000).optional(),
  generationPrompt: z.string().trim().max(6000).optional(),
  destinationUrl: z.string().url(),
  platforms: z.array(marketingPlatformSchema).min(1),
  utmParams: z.object({
    utm_source: z.string().trim().min(1),
    utm_campaign: z.string().trim().min(1),
    utm_medium: z.string().trim().optional(),
    utm_content: z.string().trim().optional(),
    utm_term: z.string().trim().optional()
  }),
  personaId: z.string().trim().optional()
});

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
  const parsed = previewRequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid payload", details: parsed.error.flatten() }, { status: 400 });
  }

  const template = parsed.data.templateId
    ? await getMarketingTemplateById(parsed.data.templateId)
    : null;
  const sourceContent =
    parsed.data.customContent?.trim() || template?.contentTemplate?.trim() || "";
  if (!sourceContent) {
    return NextResponse.json({ error: "Template or custom content is required" }, { status: 400 });
  }

  const generation = await generateMarketingMarkdownWithXchat({
    roles: session.roles,
    sourceContent,
    generationPrompt: parsed.data.generationPrompt,
    destinationUrl: parsed.data.destinationUrl,
    platforms: parsed.data.platforms,
    personaId: parsed.data.personaId
  });

  const rendered = renderMarketingPost({
    sourceContent,
    config: {
      destinationUrl: parsed.data.destinationUrl,
      utmParams: parsed.data.utmParams
    },
    generatedMarkdown: generation.markdown
  });

  return NextResponse.json({
    data: {
      markdown: generation.markdown,
      postText: rendered.postText,
      finalUrl: rendered.finalUrl,
      model: generation.model,
      personaName: generation.personaName
    }
  });
}
