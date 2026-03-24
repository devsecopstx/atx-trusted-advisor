import { ObjectId } from "mongodb";

import {
    buildXchatTurnMarkdownPayload,
    resolveOrCreateUserBootstrapCollection,
    uploadBuiltXchatTurnToXaiCollection
} from "@/modules/core-admin/access-request-bootstrap";
import type { ScheduledTask } from "@/modules/core-admin/types";
import {
    listXchatLogsPendingXaiSync,
    markXchatLogXaiSynced,
    markXchatLogXaiSyncFailed
} from "@/modules/xchat/repository";
import type { XChatSessionLog } from "@/modules/xchat/types";

const DEFAULT_LIMIT = 50;

function logUserIdHex(log: XChatSessionLog): string | null {
  const u = log.userId;
  if (!u) {
    return null;
  }
  return u instanceof ObjectId ? u.toHexString() : String(u);
}

function logTenantHex(log: XChatSessionLog): string | undefined {
  const t = log.tenantId;
  if (!t) {
    return undefined;
  }
  return t instanceof ObjectId ? t.toHexString() : String(t);
}

/**
 * Upload one Mongo `xchat_logs` row to the user’s xAI history collection (`user_history` source).
 * Idempotent when `syncedToXaiAt` is already set (returns ok).
 */
export async function syncXchatSessionLogToUserCollection(
  log: XChatSessionLog
): Promise<{ ok: true } | { ok: false; error: string }> {
  const logId = log._id;
  const userIdHex = logUserIdHex(log);
  if (!logId || !userIdHex) {
    return { ok: false, error: "skip: missing _id or userId" };
  }
  if (log.syncedToXaiAt) {
    return { ok: true };
  }
  const message = log.message?.trim() ?? "";
  const response = log.response?.trim() ?? "";
  if (!message && !response) {
    await markXchatLogXaiSyncFailed(logId, "empty message and response");
    return { ok: false, error: "empty message and response" };
  }

  try {
    const ctx = await resolveOrCreateUserBootstrapCollection({
      userId: userIdHex,
      tenantId: logTenantHex(log),
      email: log.userEmail
    });
    if (!ctx?.collectionId) {
      throw new Error("no user xAI collection (bootstrap)");
    }
    const built = buildXchatTurnMarkdownPayload({
      userId: userIdHex,
      tenantId: logTenantHex(log),
      personaName: log.personaName,
      model: log.model,
      scope: log.scope,
      prompt: log.message,
      response: log.response,
      createdAt: log.createdAt
    });
    const { fileId } = await uploadBuiltXchatTurnToXaiCollection(ctx.collectionId, built);
    await markXchatLogXaiSynced(logId, {
      xaiTurnFileId: fileId,
      xaiTurnPayloadHash: built.payloadHash,
      xaiTurnRetentionExpiresAt: built.retentionExpiresAt
    });
    return { ok: true };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    await markXchatLogXaiSyncFailed(logId, msg);
    return { ok: false, error: msg };
  }
}

/**
 * Scheduled `user_history_agent`: sync Mongo xchat_logs rows to each user’s xAI collection (user_history).
 */
export async function runUserHistoryAgent(
  task: ScheduledTask,
  input?: { limit?: number }
): Promise<{ status: "success" | "failed"; output: string }> {
  const limit = input?.limit ?? DEFAULT_LIMIT;
  const tenantOid = task.tenantId ?? undefined;
  const pending = await listXchatLogsPendingXaiSync({
    tenantId: tenantOid ?? null,
    limit
  });

  if (pending.length === 0) {
    return {
      status: "success",
      output: `user_history_agent: no pending xchat turns (tenant=${tenantOid?.toHexString() ?? "all"}).`
    };
  }

  let synced = 0;
  let failed = 0;
  const errors: string[] = [];

  for (const log of pending) {
    const r = await syncXchatSessionLogToUserCollection(log);
    if (r.ok) {
      synced += 1;
    } else {
      failed += 1;
      const logId = log._id;
      if (logId) {
        errors.push(`${logId.toHexString()}: ${r.error}`);
      } else {
        errors.push(r.error);
      }
    }
  }

  const tail = errors.length > 0 ? ` Errors: ${errors.slice(0, 5).join(" | ")}` : "";
  return {
    status: failed > 0 && synced === 0 ? "failed" : "success",
    output: `user_history_agent: processed=${String(pending.length)} synced=${String(synced)} failed=${String(failed)}.${tail}`
  };
}
