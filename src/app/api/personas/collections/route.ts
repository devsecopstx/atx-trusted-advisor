import { NextResponse } from "next/server";
import { z } from "zod";

import { requireAdminSession } from "@/lib/api-auth";
import { createXaiCollection, listXaiCollections } from "@/lib/xai";
import { createAuditEvent } from "@/modules/audit/repository";

type CollectionInventoryItem = {
  id: string;
  name?: string;
  stats: {
    documentCount: number | null;
    chunkCount: number | null;
    fileCount: number | null;
    indexStatus: string | null;
    /** xAI last sync / index time when provided; otherwise mirrors updatedAt from inventory. */
    lastSyncedAt: string | null;
    createdAt: string | null;
    updatedAt: string | null;
    usageStats: Record<string, unknown> | null;
  };
};

const createCollectionBodySchema = z.object({
  name: z.string().trim().min(2).max(120)
});

type XaiManagementErrorCode =
  | "payload_too_large"
  | "invalid_json"
  | "validation_error"
  | "missing_management_key"
  | "upstream_unauthorized"
  | "upstream_forbidden"
  | "upstream_error";

const COLLECTIONS_PAYLOAD_LIMIT_BYTES = 32 * 1024;
const TRUSTED_ADVISOR_ROOT_RE = /^atx-trusted-advisor-(dev|stage|prod)$/i;
const TRUSTED_ADVISOR_SEGMENTS = [
  "example-prompts",
  "finance-core",
  "options-strategy",
  "xchat-history",
  "xpersonas"
] as const;
const TRUSTED_ADVISOR_XCHAT_PLACEHOLDER = "xchat-<user>-<date>";

export async function GET() {
  const session = await requireAdminSession();
  if (session instanceof NextResponse) {
    return session;
  }

  try {
    const collections = await listXaiCollections();
    const normalized: CollectionInventoryItem[] = collections
      .map((collection) => ({
        id: collection.id,
        name: collection.name,
        stats: {
          documentCount: collection.documentCount ?? null,
          chunkCount: collection.chunkCount ?? null,
          fileCount: collection.fileCount ?? null,
          indexStatus: collection.indexStatus ?? null,
          lastSyncedAt: collection.lastSyncedAt ?? collection.updatedAt ?? null,
          createdAt: collection.createdAt ?? null,
          updatedAt: collection.updatedAt ?? null,
          usageStats:
            collection.usageStats && Object.keys(collection.usageStats).length > 0
              ? collection.usageStats
              : null
        }
      }))
      .sort((left, right) =>
        (left.name ?? left.id).localeCompare(right.name ?? right.id, undefined, {
          sensitivity: "base"
        })
      );

    return NextResponse.json({ data: normalized });
  } catch (error) {
    const code = classifyXaiManagementError(error);
    console.error("xpersona collection inventory fetch failed", {
      code,
      error: error instanceof Error ? error.message : "Unknown error"
    });
    return NextResponse.json(
      { error: "Failed to load xAI collection inventory", code },
      { status: 502 }
    );
  }
}

export async function POST(request: Request) {
  const session = await requireAdminSession();
  if (session instanceof NextResponse) {
    return session;
  }

  const contentLengthHeader = request.headers.get("content-length");
  if (contentLengthHeader) {
    const parsedLength = Number(contentLengthHeader);
    if (Number.isFinite(parsedLength) && parsedLength > COLLECTIONS_PAYLOAD_LIMIT_BYTES) {
      return NextResponse.json(
        { error: "Collection payload too large", code: "payload_too_large" },
        { status: 413 }
      );
    }
  }

  const body = await request.json().catch(() => null);
  if (body === null) {
    return NextResponse.json(
      { error: "Invalid JSON payload", code: "invalid_json" },
      { status: 400 }
    );
  }
  const parsed = createCollectionBodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid collection payload", code: "validation_error", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  try {
    const requestedName = parsed.data.name.trim();
    const hierarchy = await createTrustedAdvisorHierarchyIfNeeded(requestedName);
    const created = hierarchy?.root ?? (await createXaiCollection(requestedName));
    enqueueAuditEvent({
      entityType: "xpersona",
      entityId: created.id,
      action: "collection_created",
      actor: {
        userId: session.userId,
        email: session.email,
        username: session.username
      },
      details: {
        collectionName: created.name,
        ...(hierarchy
          ? {
              hierarchyCreated: true,
              hierarchyChildCount: hierarchy.children.length
            }
          : {})
      }
    });
    return NextResponse.json({
      data: {
        id: created.id,
        name: created.name,
        ...(hierarchy
          ? {
              hierarchy: {
                children: hierarchy.children.map((child) => child.name),
                xchatPlaceholder: hierarchy.xchatPlaceholder.name
              }
            }
          : {}),
        stats: {
          documentCount: null,
          chunkCount: null,
          fileCount: null,
          indexStatus: null,
          lastSyncedAt: null,
          createdAt: null,
          updatedAt: null,
          usageStats: null
        }
      }
    });
  } catch (error) {
    const code = classifyXaiManagementError(error);
    console.error("xpersona collection create failed", {
      code,
      error: error instanceof Error ? error.message : "Unknown error"
    });
    return NextResponse.json({ error: "Failed to create xAI collection", code }, { status: 502 });
  }
}

async function createTrustedAdvisorHierarchyIfNeeded(collectionName: string): Promise<{
  root: { id: string; name: string };
  children: Array<{ id: string; name: string }>;
  xchatPlaceholder: { id: string; name: string };
} | null> {
  if (!TRUSTED_ADVISOR_ROOT_RE.test(collectionName)) {
    return null;
  }

  const root = await createXaiCollection(collectionName);
  const children: Array<{ id: string; name: string }> = [];

  for (const segment of TRUSTED_ADVISOR_SEGMENTS) {
    const created = await createXaiCollection(`${root.name}/${segment}`);
    children.push(created);
  }

  const xchatPlaceholder = await createXaiCollection(
    `${root.name}/xchat-history/${TRUSTED_ADVISOR_XCHAT_PLACEHOLDER}`
  );

  return { root, children, xchatPlaceholder };
}

function enqueueAuditEvent(input: Parameters<typeof createAuditEvent>[0]) {
  void createAuditEvent(input).catch((error: unknown) => {
    console.error("xpersona collection audit write failed", {
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
  if (
    lowered.includes("401") ||
    lowered.includes("unauthorized") ||
    lowered.includes("authentication")
  ) {
    return "upstream_unauthorized";
  }
  if (lowered.includes("403") || lowered.includes("forbidden")) {
    return "upstream_forbidden";
  }
  return "upstream_error";
}
