import { NextResponse } from "next/server";

import { requireAdminSession } from "@/lib/api-auth";
import { deleteXaiCollection, getXaiCollectionById, XaiCollectionNotFoundError } from "@/lib/xai";
import { createAuditEvent } from "@/modules/audit/repository";

type RouteContext = {
  params: Promise<{ collectionId: string }>;
};

type XaiManagementErrorCode =
  | "missing_management_key"
  | "upstream_unauthorized"
  | "upstream_forbidden"
  | "upstream_not_found"
  | "upstream_error";

export async function GET(_request: Request, context: RouteContext) {
  const session = await requireAdminSession();
  if (session instanceof NextResponse) {
    return session;
  }

  const { collectionId } = await context.params;
  const normalizedId = collectionId?.trim();
  if (!normalizedId) {
    return NextResponse.json({ error: "Collection ID required" }, { status: 400 });
  }

  try {
    const stats = await getXaiCollectionById(normalizedId);
    return NextResponse.json({
      data: {
        id: stats.id,
        name: stats.name,
        stats: {
          documentCount: stats.documentCount ?? null,
          chunkCount: stats.chunkCount ?? null,
          fileCount: stats.fileCount ?? null,
          indexStatus: stats.indexStatus ?? null,
          lastSyncedAt: stats.lastSyncedAt ?? stats.updatedAt ?? null,
          createdAt: stats.createdAt ?? null,
          updatedAt: stats.updatedAt ?? null,
          usageStats:
            stats.usageStats && Object.keys(stats.usageStats).length > 0 ? stats.usageStats : null
        }
      }
    });
  } catch (error) {
    if (error instanceof XaiCollectionNotFoundError) {
      return NextResponse.json({ error: error.message, code: "collection_not_found" }, { status: 404 });
    }
    console.error("xpersona collection stats fetch failed", {
      collectionId: normalizedId,
      error: error instanceof Error ? error.message : "Unknown error"
    });
    return NextResponse.json({ error: "Failed to load collection stats" }, { status: 502 });
  }
}

export async function DELETE(_request: Request, context: RouteContext) {
  const session = await requireAdminSession();
  if (session instanceof NextResponse) {
    return session;
  }

  const { collectionId } = await context.params;
  const normalizedId = collectionId.trim();
  if (!normalizedId) {
    return NextResponse.json({ error: "Collection id is required", code: "validation_error" }, { status: 400 });
  }

  try {
    await deleteXaiCollection(normalizedId);
  } catch (error) {
    const code = classifyXaiManagementError(error);
    const message = error instanceof Error ? error.message : String(error);
    const status =
      code === "upstream_not_found"
        ? 404
        : code === "upstream_unauthorized" || code === "upstream_forbidden"
          ? 502
          : 502;
    return NextResponse.json({ error: "Failed to delete xAI collection", code, details: message }, { status });
  }

  enqueueAuditEvent({
    entityType: "xpersona",
    entityId: normalizedId,
    action: "collection_deleted",
    actor: {
      userId: session.userId,
      email: session.email,
      username: session.username
    },
    details: {
      collectionId: normalizedId
    }
  });

  return NextResponse.json({ ok: true });
}

function enqueueAuditEvent(input: Parameters<typeof createAuditEvent>[0]) {
  void createAuditEvent(input).catch((error: unknown) => {
    console.error("xpersona collection delete audit write failed", {
      action: input.action,
      entityId: input.entityId,
      error: error instanceof Error ? error.message : "Unknown audit error"
    });
  });
}

function classifyXaiManagementError(error: unknown): XaiManagementErrorCode {
  const message = error instanceof Error ? error.message : String(error);
  const lowered = message.toLowerCase();
  if (lowered.includes("missing xai_management_api_key") || lowered.includes("missing xai_api_key")) {
    return "missing_management_key";
  }
  if (lowered.includes("404") || lowered.includes("not found")) {
    return "upstream_not_found";
  }
  if (lowered.includes("401") || lowered.includes("unauthorized") || lowered.includes("authentication")) {
    return "upstream_unauthorized";
  }
  if (lowered.includes("403") || lowered.includes("forbidden")) {
    return "upstream_forbidden";
  }
  return "upstream_error";
}
