import { ObjectId } from "mongodb";
import { NextResponse } from "next/server";

import { requireApprovedAppUserSession } from "@/lib/api-auth";
import { bustUserPromptTemplatesListServerCache } from "@/modules/xchat/xchat-user-prompt-templates-list-cache";
import { deleteUserPromptTemplate } from "@/modules/xchat/xchat-user-prompt-templates-repository";

type RouteParams = { params: Promise<{ id: string }> };

export async function DELETE(_request: Request, ctx: RouteParams) {
  const session = await requireApprovedAppUserSession();
  if (session instanceof NextResponse) {
    return session;
  }
  if (!ObjectId.isValid(session.userId)) {
    return NextResponse.json({ error: "Invalid session user" }, { status: 400 });
  }

  const { id } = await ctx.params;
  const tid = id?.trim() ?? "";
  if (!ObjectId.isValid(tid)) {
    return NextResponse.json({ error: "Invalid template id", code: "invalid_id" }, { status: 400 });
  }

  const deleted = await deleteUserPromptTemplate({
    userId: new ObjectId(session.userId),
    templateId: new ObjectId(tid)
  });
  if (!deleted) {
    return NextResponse.json({ error: "Template not found", code: "not_found" }, { status: 404 });
  }

  bustUserPromptTemplatesListServerCache(session.userId);
  return NextResponse.json({ data: { deleted: true } });
}
