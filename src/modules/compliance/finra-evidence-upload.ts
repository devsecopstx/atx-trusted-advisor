import { ObjectId } from "mongodb";

import { chunkText, isTextLikeMimeType } from "@/lib/rag";
import { addFileToXaiCollection, uploadFileToXai } from "@/lib/xai";
import { resolveOrCreateUserBootstrapCollection } from "@/modules/core-admin/access-request-bootstrap";
import {
    ADVISOR_FINRA_EVIDENCE_SCOPE,
    createRagFile,
    replaceRagChunks
} from "@/modules/xchat/repository";

export const MAX_FINRA_EVIDENCE_BYTES = 5 * 1024 * 1024;
const MAX_CONTENT_PREVIEW = 1_200;

export type FinraEvidenceUploadResult = {
  evidenceFilename: string;
  evidenceXaiFileId: string;
  evidenceRagFileId: ObjectId;
  evidenceCollectionId: string;
  linkedToCollection: boolean;
  linkError?: string;
};

export async function uploadFinraCredentialEvidenceToUserXchatHistory(input: {
  userId: string;
  tenantId: string;
  email: string;
  filename: string;
  mimeType: string;
  bytes: Uint8Array;
}): Promise<FinraEvidenceUploadResult | { error: string }> {
  if (!ObjectId.isValid(input.userId) || !ObjectId.isValid(input.tenantId)) {
    return { error: "invalid_scope" };
  }
  if (input.bytes.byteLength > MAX_FINRA_EVIDENCE_BYTES) {
    return { error: "evidence_file_too_large" };
  }
  const filename = input.filename.trim();
  if (!filename) {
    return { error: "evidence_file_required" };
  }

  const userCollection = await resolveOrCreateUserBootstrapCollection({
    userId: input.userId,
    tenantId: input.tenantId,
    email: input.email
  });
  const collectionId = userCollection?.collectionId?.trim() ?? "";
  if (!collectionId) {
    return { error: "user_xchat_history_collection_unavailable" };
  }

  const mimeType = input.mimeType.trim() || "application/octet-stream";
  const canExtractText = isTextLikeMimeType(mimeType);
  const contentText = canExtractText ? new TextDecoder("utf-8").decode(input.bytes) : "";
  const contentPreview = contentText.slice(0, MAX_CONTENT_PREVIEW);

  let xaiFileId: string;
  let xaiUploadStatus: "uploaded" | "failed" = "uploaded";
  let xaiProcessingStatus: "pending" | "processing" | "complete" | "failed" | "skipped" | "unknown" =
    "unknown";
  let xaiUploadError: string | undefined;
  try {
    const upload = await uploadFileToXai(filename, input.bytes);
    xaiFileId = upload.fileId;
    xaiProcessingStatus = upload.processingStatus;
  } catch (error) {
    xaiUploadStatus = "failed";
    xaiProcessingStatus = "failed";
    xaiUploadError = error instanceof Error ? error.message : "Unknown upload error";
    return { error: "evidence_upload_failed" };
  }

  const userId = new ObjectId(input.userId);
  const tenantId = new ObjectId(input.tenantId);
  const ragFile = await createRagFile({
    userId,
    tenantId,
    userEmail: input.email,
    filename,
    mimeType,
    sizeBytes: input.bytes.byteLength,
    uploadedBy: input.email,
    scope: ADVISOR_FINRA_EVIDENCE_SCOPE,
    xaiFileId,
    xaiUploadStatus,
    xaiProcessingStatus,
    xaiProcessingCheckedAt: new Date(),
    xaiUploadError,
    contentPreview
  });

  if (!ragFile._id) {
    return { error: "evidence_metadata_failed" };
  }

  let linkedToCollection = false;
  let linkError: string | undefined;
  if (xaiUploadStatus === "uploaded") {
    try {
      await addFileToXaiCollection({ collectionId, fileId: xaiFileId });
      linkedToCollection = true;
    } catch (error) {
      linkError = error instanceof Error ? error.message : "Link to user xChat history collection failed";
    }
  }

  if (contentText) {
    const chunks = chunkText(contentText);
    await replaceRagChunks(ragFile._id, ADVISOR_FINRA_EVIDENCE_SCOPE, { userId, tenantId }, chunks);
  }

  return {
    evidenceFilename: filename,
    evidenceXaiFileId: xaiFileId,
    evidenceRagFileId: ragFile._id,
    evidenceCollectionId: collectionId,
    linkedToCollection,
    linkError
  };
}
