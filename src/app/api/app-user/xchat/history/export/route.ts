import { ObjectId } from "mongodb";
import { NextResponse } from "next/server";

import { requireSessionAndAppTenantObjectId } from "@/lib/require-app-user-tenant";
import { getTenantByHexIdCached } from "@/lib/server-request-cache";
import {
    getXChatHistoryStatsByUser,
    listAllXChatHistoryForExport
} from "@/modules/xchat/repository";
import { getXchatUserPreferences } from "@/modules/xchat/user-preferences-repository";

export const dynamic = "force-dynamic";

function safeExportFilenameStem(input: string): string {
  const stem = input.trim().toLowerCase().replace(/[^a-z0-9._-]+/g, "-").replace(/^-+|-+$/g, "");
  return stem.length > 0 ? stem.slice(0, 48) : "user";
}

function jsonAttachmentResponse(payload: unknown, filename: string): NextResponse {
  const body = JSON.stringify(payload, null, 2);
  return new NextResponse(body, {
    status: 200,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store"
    }
  });
}

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
  const [prefs, stats, tenant, rows] = await Promise.all([
    getXchatUserPreferences({ userId, tenantId: tenantOid }),
    getXChatHistoryStatsByUser({ userId, tenantId: tenantOid }),
    getTenantByHexIdCached(session.tenantId),
    listAllXChatHistoryForExport({ userId, tenantId: tenantOid })
  ]);

  const keepLastTenMessages = prefs?.keepLastTenMessages === true;
  const exportedAt = new Date().toISOString();
  const emailStem = safeExportFilenameStem(session.email.split("@")[0] ?? session.userId);

  const payload = {
    exportedAt,
    exportVersion: "2026-05-xchat-history-v1",
    user: {
      userId: session.userId,
      email: session.email,
      tenantId: session.tenantId
    },
    tenant: {
      name: tenant?.name ?? null,
      slug: tenant?.slug ?? null
    },
    retention: {
      keepLastTenMessages,
      consentedAt: prefs?.consentedAt?.toISOString() ?? null
    },
    stats: {
      totalPrompts: stats.totalPrompts,
      activeDays: stats.activeDays,
      lastPromptAt: stats.lastPromptAt?.toISOString() ?? null,
      referencedFileCount: stats.referencedFileCount
    },
    turns: rows.map((row) => ({
      id: row.id,
      threadId: row.threadId ?? null,
      createdAt: row.createdAt.toISOString(),
      personaId: row.personaId ?? null,
      model: row.model,
      message: row.message,
      response: row.response,
      contextReferenceCount: row.contextReferenceCount,
      toolCallCount: row.toolCallCount,
      interactionGenerationMs: row.interactionGenerationMs ?? null
    })),
    truncated: rows.length >= 500,
    note: keepLastTenMessages
      ? "Mongo-backed xChat turns for this user and tenant (newest first, export capped at 500 turns)."
      : "Chat history retention is off — export may be empty even if ephemeral UI showed recent prompts."
  };

  return jsonAttachmentResponse(payload, `xchat-history-${emailStem}-${exportedAt.slice(0, 10)}.json`);
}
