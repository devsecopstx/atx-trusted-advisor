import { ObjectId } from "mongodb";
import { NextResponse } from "next/server";

import { requireSessionUser } from "@/lib/auth";
import {
    getXChatHistoryStatsByUser,
    resolveDefaultXchatPersonaForSession
} from "@/modules/xchat/repository";
import { isXchatRemoteHistoryEnabled } from "@/modules/xchat/xchat-platform-settings";

export async function GET() {
  const session = await requireSessionUser();
  if (session instanceof NextResponse) {
    return session;
  }

  if (!ObjectId.isValid(session.userId)) {
    return NextResponse.json({ error: "Invalid session user id" }, { status: 400 });
  }

  const userId = new ObjectId(session.userId);
  const tenantId = ObjectId.isValid(session.tenantId)
    ? new ObjectId(session.tenantId)
    : null;

  const [stats, persona] = await Promise.all([
    getXChatHistoryStatsByUser({ userId, tenantId }),
    resolveDefaultXchatPersonaForSession(session.roles)
  ]);
  const historyMode = isXchatRemoteHistoryEnabled() ? "xai_remote" : "mongo";

  return NextResponse.json({
    data: {
      ...stats,
      lastPromptAt: stats.lastPromptAt?.toISOString(),
      collectionId: persona?.xaiCollection?.collectionId ?? null,
      historyMode
    }
  });
}
