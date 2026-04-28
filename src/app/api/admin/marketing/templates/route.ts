import { NextResponse } from "next/server";

import { requireAdminSession } from "@/lib/api-auth";
import { listMarketingTemplates } from "@/modules/marketing/repository";

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
