import { ObjectId } from "mongodb";
import { NextResponse } from "next/server";

import { requireApprovedAppUserSession } from "@/lib/api-auth";
import type { SessionUser } from "@/lib/auth";
import { getDb } from "@/lib/mongodb";
import { chunkText, isTextLikeMimeType } from "@/lib/rag";
import { checkRateLimit } from "@/lib/rate-limit";
import { normalizeSubscriptionPlan } from "@/lib/subscription-plan";
import { addFileToXaiCollection, uploadFileToXai } from "@/lib/xai";
import { canAccessPremiumTenantAttachments } from "@/lib/xchat-premium-attachments-policy";
import { getCoreUserByIdCached, getTenantByHexIdCached } from "@/lib/server-request-cache";
import { ensureTenantTeamXchatAttachmentsCollection } from "@/modules/platform/tenant-xchat-team-collection";
import {
    createRagFile,
    listRagFilesForTenantAndScope,
    replaceRagChunks,
    TENANT_PREMIUM_ATTACHMENTS_SCOPE
} from "@/modules/xchat/repository";
import type { RagSourceFile } from "@/modules/xchat/types";

const MAX_ATTACHMENT_BYTES = 5 * 1024 * 1024;
const MAX_CONTENT_PREVIEW = 1_200;
const GET_WINDOW_MS = 60_000;
const GET_MAX = 60;
const POST_WINDOW_MS = 60_000;
const POST_MAX = 10;

function serializeRagFileForClient(f: RagSourceFile) {
  return {
    _id: f._id?.toHexString(),
    filename: f.filename,
    mimeType: f.mimeType,
    sizeBytes: f.sizeBytes,
    xaiUploadStatus: f.xaiUploadStatus,
    xaiProcessingStatus: f.xaiProcessingStatus,
    xaiUploadError: f.xaiUploadError,
    createdAt: f.createdAt instanceof Date ? f.createdAt.toISOString() : undefined
  };
}

async function requirePremiumAttachmentsSession(): Promise<SessionUser | NextResponse> {
  const session = await requireApprovedAppUserSession();
  if (session instanceof NextResponse) {
    return session;
  }
  let plan = normalizeSubscriptionPlan(undefined);
  if (ObjectId.isValid(session.userId)) {
    const user = await getCoreUserByIdCached(session.userId);
    plan = normalizeSubscriptionPlan(user?.subscriptionPlan);
  }
  if (!canAccessPremiumTenantAttachments(plan, session.roles)) {
    return NextResponse.json({ error: "Tenant file attachments require Premium+." }, { status: 403 });
  }
  if (!ObjectId.isValid(session.tenantId)) {
    return NextResponse.json({ error: "Invalid tenant" }, { status: 400 });
  }
  return session;
}

export async function GET() {
  const session = await requirePremiumAttachmentsSession();
  if (session instanceof NextResponse) {
    return session;
  }

  const rl = checkRateLimit({
    key: `xchat-attachments:get:${session.userId}`,
    windowMs: GET_WINDOW_MS,
    max: GET_MAX
  });
  if (!rl.allowed) {
    return NextResponse.json(
      { error: "Rate limit exceeded", retryAfterSeconds: Math.ceil((rl.resetAtMs - Date.now()) / 1000) },
      { status: 429 }
    );
  }

  const tenant = await getTenantByHexIdCached(session.tenantId);
  if (!tenant?._id) {
    return NextResponse.json({ error: "Tenant not found" }, { status: 404 });
  }

  const db = await getDb();
  let collectionId = tenant.tenantPreferences?.xchat_team_attachments_collection_id?.trim() ?? "";
  let collectionName = tenant.tenantPreferences?.xchat_team_attachments_collection_name?.trim() ?? "";
  if (!collectionId) {
    const ensured = await ensureTenantTeamXchatAttachmentsCollection({
      db,
      tenantSlug: tenant.slug,
      tenantObjectId: tenant._id,
      tenantPreferences: tenant.tenantPreferences
    });
    if (ensured?.collectionId) {
      collectionId = ensured.collectionId;
      collectionName = ensured.collectionName;
    }
  }

  const tenantOid = new ObjectId(session.tenantId);
  const files = await listRagFilesForTenantAndScope(tenantOid, TENANT_PREMIUM_ATTACHMENTS_SCOPE);

  return NextResponse.json({
    data: {
      files: files.map(serializeRagFileForClient),
      collectionId: collectionId || null,
      collectionName: collectionName || null,
      collectionConfigured: Boolean(collectionId)
    }
  });
}

export async function POST(request: Request) {
  const session = await requirePremiumAttachmentsSession();
  if (session instanceof NextResponse) {
    return session;
  }

  const rl = checkRateLimit({
    key: `xchat-attachments:post:${session.userId}`,
    windowMs: POST_WINDOW_MS,
    max: POST_MAX
  });
  if (!rl.allowed) {
    return NextResponse.json(
      { error: "Rate limit exceeded", retryAfterSeconds: Math.ceil((rl.resetAtMs - Date.now()) / 1000) },
      { status: 429 }
    );
  }

  const contentLength = Number(request.headers.get("content-length") ?? "0");
  if (Number.isFinite(contentLength) && contentLength > MAX_ATTACHMENT_BYTES + 2_048) {
    return NextResponse.json({ error: "Payload too large" }, { status: 413 });
  }

  const formData = await request.formData();
  const file = formData.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Missing file upload" }, { status: 400 });
  }
  if (file.size > MAX_ATTACHMENT_BYTES) {
    return NextResponse.json({ error: `File too large. Max bytes: ${MAX_ATTACHMENT_BYTES}` }, { status: 413 });
  }

  const tenant = await getTenantByHexIdCached(session.tenantId);
  if (!tenant?._id) {
    return NextResponse.json({ error: "Tenant not found" }, { status: 404 });
  }

  const db = await getDb();
  let collectionId = tenant.tenantPreferences?.xchat_team_attachments_collection_id?.trim() ?? "";
  if (!collectionId) {
    const ensured = await ensureTenantTeamXchatAttachmentsCollection({
      db,
      tenantSlug: tenant.slug,
      tenantObjectId: tenant._id,
      tenantPreferences: tenant.tenantPreferences
    });
    collectionId = ensured?.collectionId?.trim() ?? "";
  }

  const arrayBuffer = await file.arrayBuffer();
  const bytes = new Uint8Array(arrayBuffer);
  const mimeType = file.type || "application/octet-stream";
  const canExtractText = isTextLikeMimeType(mimeType);
  const contentText = canExtractText ? new TextDecoder("utf-8").decode(bytes) : "";
  const contentPreview = contentText.slice(0, MAX_CONTENT_PREVIEW);

  let xaiFileId: string | undefined;
  let xaiUploadStatus: "uploaded" | "failed" | "skipped" = "skipped";
  let xaiProcessingStatus: "pending" | "processing" | "complete" | "failed" | "skipped" | "unknown" = "unknown";
  let xaiUploadError: string | undefined;
  try {
    const upload = await uploadFileToXai(file.name, bytes);
    xaiFileId = upload.fileId;
    xaiUploadStatus = "uploaded";
    xaiProcessingStatus = upload.processingStatus;
  } catch (error) {
    xaiUploadStatus = "failed";
    xaiProcessingStatus = "failed";
    xaiUploadError = error instanceof Error ? error.message : "Unknown upload error";
  }

  const userId = new ObjectId(session.userId);
  const tenantOid = new ObjectId(session.tenantId);
  const ragFile = await createRagFile({
    userId,
    tenantId: tenantOid,
    userEmail: session.email,
    filename: file.name,
    mimeType,
    sizeBytes: file.size,
    uploadedBy: session.username,
    scope: TENANT_PREMIUM_ATTACHMENTS_SCOPE,
    xaiFileId,
    xaiUploadStatus,
    xaiProcessingStatus,
    xaiProcessingCheckedAt: new Date(),
    xaiUploadError,
    contentPreview
  });

  let linkedToCollection = false;
  let linkError: string | undefined;
  /** Link as soon as the file id exists — same as `uploadBuiltXchatTurnToXaiCollection`. Do not wait for embeddings; `isRagFileReadyForSemanticSearch` would block when xAI omits or uses an unfamiliar `processing_status` (shown as "unknown" in UI). */
  if (collectionId && ragFile._id && xaiFileId && xaiUploadStatus === "uploaded") {
    try {
      await addFileToXaiCollection({ collectionId, fileId: xaiFileId });
      linkedToCollection = true;
    } catch (error) {
      linkError = error instanceof Error ? error.message : "Link to tenant xAI collection failed";
    }
  }

  if (ragFile._id && contentText) {
    const chunks = chunkText(contentText);
    await replaceRagChunks(ragFile._id, TENANT_PREMIUM_ATTACHMENTS_SCOPE, { userId, tenantId: tenantOid }, chunks);
  }

  return NextResponse.json(
    {
      data: {
        file: serializeRagFileForClient(ragFile),
        linkedToCollection,
        linkError,
        collectionId: collectionId || null
      }
    },
    { status: 201 }
  );
}
