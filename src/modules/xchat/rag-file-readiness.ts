import { ObjectId } from "mongodb";

import { getXaiFileMetadata, type XaiFileProcessingStatus } from "@/lib/xai";
import {
    getRagFileById,
    listRagFiles,
    updateRagFileProcessingState
} from "@/modules/xchat/repository";
import type { RagSourceFile } from "@/modules/xchat/types";

export type RagReadinessStatus =
  | "ready"
  | "not_uploaded"
  | "pending_embeddings"
  | "processing_embeddings"
  | "embedding_failed"
  | "unknown";

export type RagFileReadiness = {
  fileId: string;
  xaiFileId?: string;
  readiness: RagReadinessStatus;
  processingStatus: XaiFileProcessingStatus;
  message?: string;
  checkedAt: string;
};

export type RagScopeReadinessSummary = {
  blocked: boolean;
  nonReadyFiles: RagFileReadiness[];
};

export function isRagFileReadyForSemanticSearch(file: RagSourceFile): boolean {
  if (file.xaiUploadStatus !== "uploaded") {
    return false;
  }
  const processingStatus = normalizeProcessingStatus(file.xaiProcessingStatus);
  return processingStatus === "complete" || processingStatus === "skipped";
}

export function evaluateRagFileReadiness(file: RagSourceFile): RagFileReadiness {
  const checkedAt = (file.xaiProcessingCheckedAt ?? file.createdAt ?? new Date()).toISOString();
  const processingStatus = normalizeProcessingStatus(file.xaiProcessingStatus);
  const fileId = file._id?.toHexString() ?? "";
  if (file.xaiUploadStatus !== "uploaded") {
    return {
      fileId,
      xaiFileId: file.xaiFileId,
      readiness: "not_uploaded",
      processingStatus,
      message: "Upload is not completed.",
      checkedAt
    };
  }
  switch (processingStatus) {
    case "complete":
    case "skipped":
      return {
        fileId,
        xaiFileId: file.xaiFileId,
        readiness: "ready",
        processingStatus,
        checkedAt
      };
    case "pending":
      return {
        fileId,
        xaiFileId: file.xaiFileId,
        readiness: "pending_embeddings",
        processingStatus,
        message: "Embedding/indexing is pending.",
        checkedAt
      };
    case "processing":
      return {
        fileId,
        xaiFileId: file.xaiFileId,
        readiness: "processing_embeddings",
        processingStatus,
        message: "Embedding/indexing is processing.",
        checkedAt
      };
    case "failed":
      return {
        fileId,
        xaiFileId: file.xaiFileId,
        readiness: "embedding_failed",
        processingStatus,
        message: file.xaiUploadError?.trim() || "Embedding/indexing failed.",
        checkedAt
      };
    default:
      return {
        fileId,
        xaiFileId: file.xaiFileId,
        readiness: "unknown",
        processingStatus,
        message: "Readiness state is unknown.",
        checkedAt
      };
  }
}

export async function pollRagFileReadiness(fileId: ObjectId): Promise<RagFileReadiness | null> {
  const file = await getRagFileById(fileId);
  if (!file) {
    return null;
  }
  const now = new Date();
  const xaiFileId = file.xaiFileId?.trim();
  if (file.xaiUploadStatus === "uploaded" && xaiFileId) {
    try {
      const metadata = await getXaiFileMetadata(xaiFileId);
      await updateRagFileProcessingState(fileId, {
        xaiProcessingStatus: metadata.processingStatus,
        xaiProcessingCheckedAt: now,
        xaiUploadError: metadata.uploadErrorMessage
      });
      return evaluateRagFileReadiness({
        ...file,
        xaiProcessingStatus: metadata.processingStatus,
        xaiProcessingCheckedAt: now,
        xaiUploadError: metadata.uploadErrorMessage
      });
    } catch (error) {
      await updateRagFileProcessingState(fileId, {
        xaiProcessingStatus: "unknown",
        xaiProcessingCheckedAt: now,
        xaiUploadError: error instanceof Error ? error.message : "Failed readiness poll"
      });
      return evaluateRagFileReadiness({
        ...file,
        xaiProcessingStatus: "unknown",
        xaiProcessingCheckedAt: now,
        xaiUploadError: error instanceof Error ? error.message : "Failed readiness poll"
      });
    }
  }
  await updateRagFileProcessingState(fileId, {
    xaiProcessingStatus: normalizeProcessingStatus(file.xaiProcessingStatus),
    xaiProcessingCheckedAt: now,
    xaiUploadError: file.xaiUploadError
  });
  return evaluateRagFileReadiness({
    ...file,
    xaiProcessingCheckedAt: now
  });
}

export async function getScopeReadinessSummary(input: {
  scope: string;
  tenantId?: ObjectId;
}): Promise<RagScopeReadinessSummary> {
  const files = await listRagFiles({
    scope: input.scope,
    tenantId: input.tenantId
  });
  const nonReadyFiles = files
    .filter((file) => file.xaiUploadStatus === "uploaded")
    .map((file) => evaluateRagFileReadiness(file))
    .filter((entry) => entry.readiness !== "ready");
  return {
    blocked: nonReadyFiles.length > 0,
    nonReadyFiles
  };
}

function normalizeProcessingStatus(value: RagSourceFile["xaiProcessingStatus"]): XaiFileProcessingStatus {
  if (!value) {
    return "unknown";
  }
  return value;
}
