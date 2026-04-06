import { ObjectId } from "mongodb";
import { NextResponse } from "next/server";
import { z } from "zod";

import { requireAdminSession } from "@/lib/api-auth";
import { proxyAdminUsersRequestToBackend } from "@/lib/backend-bff";
import { chunkText, isTextLikeMimeType } from "@/lib/rag";
import { checkRateLimit } from "@/lib/rate-limit";
import { uploadFileToXai } from "@/lib/xai";
import {
    createRagFile,
    listRagFiles,
    replaceRagChunks
} from "@/modules/xchat/repository";

const querySchema = z.object({
  scope: z.string().optional()
});

const MAX_RAG_UPLOAD_BYTES = 5 * 1024 * 1024;
const MAX_RAG_CONTENT_PREVIEW = 1_200;
const RAG_GET_RATE_WINDOW_MS = 60_000;
const RAG_GET_RATE_MAX = 60;
const RAG_POST_RATE_WINDOW_MS = 60_000;
const RAG_POST_RATE_MAX = 10;

export async function GET(request: Request) {
  const proxied = await proxyAdminUsersRequestToBackend(request);
  if (proxied) {
    return proxied;
  }

  const session = await requireAdminSession();
  if (session instanceof NextResponse) {
    return session;
  }
  const rateLimit = checkRateLimit({
    key: `rag-files:get:${session.userId}`,
    windowMs: RAG_GET_RATE_WINDOW_MS,
    max: RAG_GET_RATE_MAX
  });
  if (!rateLimit.allowed) {
    return NextResponse.json(
      {
        error: "Rate limit exceeded",
        retryAfterSeconds: Math.ceil((rateLimit.resetAtMs - Date.now()) / 1000)
      },
      { status: 429 }
    );
  }

  const url = new URL(request.url);
  const query = querySchema.safeParse({
    scope: url.searchParams.get("scope") ?? undefined
  });
  if (!query.success) {
    return NextResponse.json({ error: "Invalid query parameters" }, { status: 400 });
  }

  const tenantId = ObjectId.isValid(session.tenantId)
    ? new ObjectId(session.tenantId)
    : undefined;
  const files = await listRagFiles({
    scope: query.data.scope,
    tenantId
  });
  return NextResponse.json({ data: files });
}

export async function POST(request: Request) {
  const proxied = await proxyAdminUsersRequestToBackend(request);
  if (proxied) {
    return proxied;
  }

  const session = await requireAdminSession();
  if (session instanceof NextResponse) {
    return session;
  }
  const rateLimit = checkRateLimit({
    key: `rag-files:post:${session.userId}`,
    windowMs: RAG_POST_RATE_WINDOW_MS,
    max: RAG_POST_RATE_MAX
  });
  if (!rateLimit.allowed) {
    return NextResponse.json(
      {
        error: "Rate limit exceeded",
        retryAfterSeconds: Math.ceil((rateLimit.resetAtMs - Date.now()) / 1000)
      },
      { status: 429 }
    );
  }

  const contentLength = Number(request.headers.get("content-length") ?? "0");
  if (Number.isFinite(contentLength) && contentLength > MAX_RAG_UPLOAD_BYTES + 2_048) {
    return NextResponse.json({ error: "Payload too large" }, { status: 413 });
  }

  const formData = await request.formData();
  const file = formData.get("file");
  const scopeInput = formData.get("scope");
  const scope = typeof scopeInput === "string" && scopeInput.trim() ? scopeInput.trim() : "global";

  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Missing file upload" }, { status: 400 });
  }
  if (file.size > MAX_RAG_UPLOAD_BYTES) {
    return NextResponse.json(
      { error: `File too large. Max bytes: ${MAX_RAG_UPLOAD_BYTES}` },
      { status: 413 }
    );
  }

  const arrayBuffer = await file.arrayBuffer();
  const bytes = new Uint8Array(arrayBuffer);
  const mimeType = file.type || "application/octet-stream";
  const canExtractText = isTextLikeMimeType(mimeType);
  const contentText = canExtractText ? new TextDecoder("utf-8").decode(bytes) : "";
  const contentPreview = contentText.slice(0, MAX_RAG_CONTENT_PREVIEW);

  let xaiFileId: string | undefined;
  let xaiUploadStatus: "uploaded" | "failed" | "skipped" = "skipped";
  let xaiProcessingStatus: "pending" | "processing" | "complete" | "failed" | "skipped" | "unknown" =
    "unknown";
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

  const userId = ObjectId.isValid(session.userId) ? new ObjectId(session.userId) : undefined;
  const tenantId = ObjectId.isValid(session.tenantId)
    ? new ObjectId(session.tenantId)
    : undefined;
  const ragFile = await createRagFile({
    userId,
    tenantId,
    userEmail: session.email,
    filename: file.name,
    mimeType,
    sizeBytes: file.size,
    uploadedBy: session.username,
    scope,
    xaiFileId,
    xaiUploadStatus,
    xaiProcessingStatus,
    xaiProcessingCheckedAt: new Date(),
    xaiUploadError,
    contentPreview
  });

  if (ragFile._id && contentText) {
    const chunks = chunkText(contentText);
    await replaceRagChunks(
      ragFile._id,
      scope,
      {
        userId,
        tenantId
      },
      chunks
    );
  }

  return NextResponse.json(
    {
      data: ragFile
    },
    { status: 201 }
  );
}
