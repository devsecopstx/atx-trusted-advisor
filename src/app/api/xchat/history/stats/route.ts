import { ObjectId } from "mongodb";
import { NextResponse } from "next/server";

import { requireSessionUser } from "@/lib/auth";
import { loadDefaultXchatPersonaForSessionDeduped } from "@/lib/server-request-cache";
import { getXChatHistoryStatsByUser } from "@/modules/xchat/repository";
import { getXchatUserPreferences } from "@/modules/xchat/user-preferences-repository";

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

  const [stats, persona, prefs] = await Promise.all([
    getXChatHistoryStatsByUser({ userId, tenantId }),
    loadDefaultXchatPersonaForSessionDeduped(session.roles),
    getXchatUserPreferences({ userId, tenantId })
  ]);
  const historyMode = prefs?.keepLastTenMessages ? "mongo" : "ephemeral";

  return NextResponse.json({
    data: {
      ...stats,
      lastPromptAt: stats.lastPromptAt?.toISOString(),
      collectionId: persona?.xaiCollection?.collectionId ?? null,
      historyMode
    }
  });
}
