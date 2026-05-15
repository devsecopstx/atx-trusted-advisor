import { NextResponse } from "next/server";

import { requireAdminSession } from "@/lib/api-auth";
import { createAuditEvent, listAuditEvents } from "@/modules/audit/repository";
import { syncFinanceKnowledgeBaseToXai } from "@/modules/xchat/finance-kb-sync";

const FINANCE_KB_AUDIT_ENTITY_ID = "finance-kb";
const FINANCE_KB_REFRESH_ACTION = "global_admin:finance-kb-refresh";

export async function GET() {
  const session = await requireAdminSession();
  if (session instanceof NextResponse) {
    return session;
  }

  const events = await listAuditEvents({
    entityType: "system",
    entityId: FINANCE_KB_AUDIT_ENTITY_ID,
    action: FINANCE_KB_REFRESH_ACTION,
    limit: 1
  });
  const latest = events[0];
  return NextResponse.json({
    data: {
      lastSyncAt: latest?.createdAt?.toISOString() ?? null,
      lastSyncActor: latest?.actor ?? null,
      lastSyncDetails: latest?.details ?? null
    }
  });
}

export async function POST() {
  const session = await requireAdminSession();
  if (session instanceof NextResponse) {
    return session;
  }

  const actor = { userId: session.userId, email: session.email, username: session.username };
  const result = await syncFinanceKnowledgeBaseToXai({ repoRoot: process.cwd() });

  await createAuditEvent({
    entityType: "system",
    entityId: FINANCE_KB_AUDIT_ENTITY_ID,
    action: FINANCE_KB_REFRESH_ACTION,
    actor,
    details: {
      collectionId: result.collectionId,
      collectionDisplayName: result.collectionDisplayName,
      filesUploaded: result.filesUploaded,
      fileCandidates: result.fileCandidates,
      documentsCreated: result.documentsCreated,
      documentsUpdated: result.documentsUpdated,
      existingRemoteDocuments: result.existingRemoteDocuments,
      collectionFieldDefinitionKeys: result.collectionFieldDefinitionKeys,
      changeCount: result.changes.length,
      errorCount: result.errors.length
    }
  }).catch((error) => {
    console.error("[admin/rag/refresh-finance] audit write failed", {
      error: String(error)
    });
  });

  return NextResponse.json({ data: result });
}
