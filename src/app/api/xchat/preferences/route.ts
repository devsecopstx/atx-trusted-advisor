import { ObjectId } from "mongodb";
import { NextResponse } from "next/server";
import { z } from "zod";

import { requireSessionUser } from "@/lib/auth";
import { createAuditEvent } from "@/modules/audit/repository";
import { resolveOrCreateUserBootstrapCollection } from "@/modules/core-admin/access-request-bootstrap";
import { clearXchatLogsLongTermSyncSkippedForUser } from "@/modules/xchat/repository";
import { clearPerUserXaiHistoryCollectionForUserTenant } from "@/modules/xchat/user-history-xai-purge";
import {
    getXchatUserPreferences,
    upsertXchatUserPreferences
} from "@/modules/xchat/user-preferences-repository";

const updateSchema = z.object({
  keepLastTenMessages: z.boolean(),
  enableLongTermXaiMemory: z.boolean().optional()
});

function prefsPayload(row: {
  keepLastTenMessages: boolean;
  enableLongTermXaiMemory?: boolean;
  consentedAt?: Date | null;
  xaiMemoryConsentedAt?: Date | null;
}) {
  return {
    keepLastTenMessages: row.keepLastTenMessages === true,
    enableLongTermXaiMemory: row.enableLongTermXaiMemory === true,
    consentedAt: row.consentedAt?.toISOString() ?? null,
    xaiMemoryConsentedAt: row.xaiMemoryConsentedAt?.toISOString() ?? null
  };
}

export async function GET() {
  const session = await requireSessionUser();
  if (session instanceof NextResponse) {
    return session;
  }
  if (!ObjectId.isValid(session.userId)) {
    return NextResponse.json({ error: "Invalid session user id" }, { status: 400 });
  }
  const userId = new ObjectId(session.userId);
  const tenantId = ObjectId.isValid(session.tenantId) ? new ObjectId(session.tenantId) : null;
  const row = await getXchatUserPreferences({ userId, tenantId });
  return NextResponse.json({
    data: prefsPayload({
      keepLastTenMessages: row?.keepLastTenMessages === true,
      enableLongTermXaiMemory: row?.enableLongTermXaiMemory === true,
      consentedAt: row?.consentedAt ?? null,
      xaiMemoryConsentedAt: row?.xaiMemoryConsentedAt ?? null
    })
  });
}

export async function PUT(request: Request) {
  const session = await requireSessionUser();
  if (session instanceof NextResponse) {
    return session;
  }
  if (!ObjectId.isValid(session.userId)) {
    return NextResponse.json({ error: "Invalid session user id" }, { status: 400 });
  }
  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const parsed = updateSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid request payload", details: parsed.error.flatten() },
      { status: 400 }
    );
  }
  const userId = new ObjectId(session.userId);
  const tenantId = ObjectId.isValid(session.tenantId) ? new ObjectId(session.tenantId) : null;
  const existing = await getXchatUserPreferences({ userId, tenantId });
  const hadLongTerm =
    existing?.keepLastTenMessages === true && existing?.enableLongTermXaiMemory === true;

  const row = await upsertXchatUserPreferences({
    userId,
    tenantId,
    keepLastTenMessages: parsed.data.keepLastTenMessages,
    enableLongTermXaiMemory: parsed.data.enableLongTermXaiMemory
  });

  const hasLongTerm = row.keepLastTenMessages === true && row.enableLongTermXaiMemory === true;

  if (!hadLongTerm && hasLongTerm) {
    try {
      await resolveOrCreateUserBootstrapCollection({
        userId: session.userId,
        tenantId: session.tenantId,
        email: session.email
      });
    } catch (error) {
      console.warn("[xchat/preferences] resolveOrCreateUserBootstrapCollection non-fatal", {
        userId: session.userId,
        message: error instanceof Error ? error.message : String(error)
      });
    }
    await clearXchatLogsLongTermSyncSkippedForUser({ userId, tenantId });
    void createAuditEvent({
      entityType: "core_user",
      entityId: session.userId,
      action: "xchat_long_term_xai_memory_enabled",
      actor: {
        userId: session.userId,
        email: session.email,
        username: session.username
      },
      details: {
        tenantId: session.tenantId ?? null,
        xaiMemoryConsentedAt: row.xaiMemoryConsentedAt?.toISOString() ?? null
      }
    });
  }

  if (hadLongTerm && !hasLongTerm) {
    await clearPerUserXaiHistoryCollectionForUserTenant({
      userIdHex: session.userId,
      tenantIdHex: session.tenantId ?? null
    });
    void createAuditEvent({
      entityType: "core_user",
      entityId: session.userId,
      action: "xchat_long_term_xai_memory_disabled",
      actor: {
        userId: session.userId,
        email: session.email,
        username: session.username
      },
      details: {
        tenantId: session.tenantId ?? null
      }
    });
  }

  return NextResponse.json({
    data: prefsPayload({
      keepLastTenMessages: row.keepLastTenMessages,
      enableLongTermXaiMemory: row.enableLongTermXaiMemory,
      consentedAt: row.consentedAt ?? null,
      xaiMemoryConsentedAt: row.xaiMemoryConsentedAt ?? null
    })
  });
}
