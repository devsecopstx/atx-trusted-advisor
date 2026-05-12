import { ObjectId } from "mongodb";
import { NextResponse } from "next/server";

import { requireApprovedAppUserSession } from "@/lib/api-auth";
import { getDb } from "@/lib/mongodb";
import { resolveHnwiV21ComposerPackage } from "@/modules/xchat/prompt-template-service";
import { isHnwiPromptTemplateV21Slug } from "@/modules/xchat/prompt-templates-v21-defaults";

type RouteParams = { params: Promise<{ slug: string }> };

export async function GET(request: Request, ctx: RouteParams) {
  const session = await requireApprovedAppUserSession();
  if (session instanceof NextResponse) {
    return session;
  }
  if (!ObjectId.isValid(session.userId)) {
    return NextResponse.json({ error: "Invalid session user" }, { status: 400 });
  }

  const { slug: rawSlug } = await ctx.params;
  const slug = rawSlug?.trim() ?? "";
  if (!isHnwiPromptTemplateV21Slug(slug)) {
    return NextResponse.json(
      { error: "Unknown prompt template slug", code: "unknown_slug" },
      { status: 400 }
    );
  }

  const portfolioId = new URL(request.url).searchParams.get("portfolioId")?.trim() ?? "";
  const portfolioIdHex = portfolioId && ObjectId.isValid(portfolioId) ? portfolioId : null;

  const db = await getDb();
  const resolved = await resolveHnwiV21ComposerPackage({
    db,
    slug,
    tenantIdHex: session.tenantId?.trim(),
    sessionUserId: session.userId,
    portfolioIdHex,
    coordinatingRequest: request
  });

  return NextResponse.json({
    data: {
      slug: resolved.slug,
      templateVersion: resolved.templateVersion,
      resolvedSource: resolved.resolvedSource,
      composerText: resolved.composerText
    }
  });
}
