import { ObjectId } from "mongodb";
import { NextResponse } from "next/server";

import { requireSessionAndAppTenantObjectId } from "@/lib/require-app-user-tenant";
import { loadDefaultXchatPersonaForSessionDeduped } from "@/lib/server-request-cache";
import { getXChatHistoryStatsByUser } from "@/modules/xchat/repository";
import { getXchatUserPreferences } from "@/modules/xchat/user-preferences-repository";

export async function GET() {
  const auth = await requireSessionAndAppTenantObjectId();
  if (auth instanceof NextResponse) {
    return auth;
  }
  const { session, tenantOid } = auth;

  if (!ObjectId.isValid(session.userId)) {
    return NextResponse.json({ error: "Invalid session user id" }, { status: 400 });
  }

  const userId = new ObjectId(session.userId);

  const [stats, persona, prefs] = await Promise.all([
    getXChatHistoryStatsByUser({ userId, tenantId: tenantOid }),
    loadDefaultXchatPersonaForSessionDeduped(session.roles),
    getXchatUserPreferences({ userId, tenantId: tenantOid })
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
