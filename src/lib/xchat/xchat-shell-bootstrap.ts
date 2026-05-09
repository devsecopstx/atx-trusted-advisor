import { ObjectId } from "mongodb";
import { unstable_cache } from "next/cache";
import { cache } from "react";

import type { SessionUser } from "@/lib/auth";
import { listXChatHistoryByUser } from "@/modules/xchat/repository";
import type { XChatHistoryItem } from "@/modules/xchat/types";
import { getXchatUserPreferences } from "@/modules/xchat/user-preferences-repository";

/** Serializable for RSC → client (matches `HistoryItem` in xchat-conversation). */
export type XchatShellHistoryRow = {
  id: string;
  threadId?: string;
  message: string;
  response: string;
  model: string;
  createdAt: string;
  personaId?: string;
  contextReferenceCount: number;
  toolCallCount: number;
  interactionGenerationMs?: number;
};

export type XchatServerShellBootstrap = {
  keepLastTenMessages: boolean;
  /** Opt-in xAI `user_history` / agent sync (only meaningful when `keepLastTenMessages`). */
  enableLongTermXaiMemory: boolean;
  consentedAt: string | null;
  xaiMemoryConsentedAt: string | null;
  historyItemsNewestFirst: XchatShellHistoryRow[];
};

function serializeRow(row: XChatHistoryItem): XchatShellHistoryRow {
  return {
    id: row.id,
    threadId: row.threadId,
    message: row.message,
    response: row.response,
    model: row.model,
    createdAt: row.createdAt.toISOString(),
    personaId: row.personaId,
    contextReferenceCount: row.contextReferenceCount,
    toolCallCount: row.toolCallCount,
    interactionGenerationMs: row.interactionGenerationMs
  };
}

async function readXchatShellBootstrapFromDb(
  userIdHex: string,
  tenantIdHex: string,
  historyCap: number
): Promise<XchatServerShellBootstrap | null> {
  if (!ObjectId.isValid(userIdHex)) {
    return null;
  }
  const userId = new ObjectId(userIdHex);
  const tenantId = tenantIdHex && ObjectId.isValid(tenantIdHex) ? new ObjectId(tenantIdHex) : null;
  const prefs = await getXchatUserPreferences({ userId, tenantId });
  const keepLastTenMessages = prefs?.keepLastTenMessages === true;
  const enableLongTermXaiMemory =
    keepLastTenMessages === true && prefs?.enableLongTermXaiMemory === true;
  const consentedAt = prefs?.consentedAt ? prefs.consentedAt.toISOString() : null;
  const xaiMemoryConsentedAt = prefs?.xaiMemoryConsentedAt
    ? prefs.xaiMemoryConsentedAt.toISOString()
    : null;
  /** Shell hydrate: up to 20 turns; tenant `chatHistoryMax` still clamps below when smaller. */
  const cap = Math.min(Math.max(historyCap, 1), 20);
  const rows = keepLastTenMessages
    ? await listXChatHistoryByUser({ userId, tenantId, limit: cap })
    : [];
  return {
    keepLastTenMessages,
    enableLongTermXaiMemory,
    consentedAt,
    xaiMemoryConsentedAt,
    historyItemsNewestFirst: rows.map(serializeRow)
  };
}

/** Same intent as `fetch(..., { cache: 'force-cache', next: { revalidate: 60 } })` for this Mongo-backed path. */
const getBootstrapCached = unstable_cache(readXchatShellBootstrapFromDb, ["xchat-shell-bootstrap"], {
  revalidate: 60
});

/**
 * React `cache` dedupes within one request; `unstable_cache` revalidates every 60s (user+tenant+cap keyed).
 * Aligns with GET /api/xchat/history + preferences for the signed-in xChat shell.
 */
export const getXchatServerShellBootstrap = cache(
  async (session: SessionUser, historyCap: number): Promise<XchatServerShellBootstrap | null> => {
    if (!ObjectId.isValid(session.userId)) {
      return null;
    }
    return getBootstrapCached(session.userId, session.tenantId ?? "", historyCap);
  }
);
