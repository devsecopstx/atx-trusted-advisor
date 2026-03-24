import { ObjectId } from "mongodb";

import {
  getXaiCollectionById,
  getXaiFileMetadata,
  type XaiCollectionStats,
  type XaiFileProcessingStatus
} from "@/lib/xai";
import { getRagFileById, updateRagFileProcessingState } from "@/modules/xchat/repository";
import { resolveTeamKbCollectionId } from "@/modules/xchat/team-xai-collection";
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

/**
 * xChat collection-search gate: **read-only** team KB snapshot via xAI management API (`GET …/collections/{id}`).
 * Does **not** read Mongo `xai_collections` rows — admins curate embeddings in [console.x.ai](https://console.x.ai); inventory UX stays under `/admin/rag-files`.
 *
 * When `linkedCollectionIds` is set, the check runs **only** if the resolved team KB id is among linked persona/tool collections.
 */
export async function getScopeReadinessSummary(input: {
  scope: string;
  tenantId?: ObjectId;
  linkedCollectionIds?: string[];
}): Promise<RagScopeReadinessSummary> {
  void input.scope;
  void input.tenantId;
  const linked = input.linkedCollectionIds;
  if (!linked?.length) {
    return { blocked: false, nonReadyFiles: [] };
  }
  try {
    const teamKbId = await resolveTeamKbCollectionId();
    const normalizedTeam = teamKbId?.trim();
    if (!normalizedTeam) {
      return { blocked: false, nonReadyFiles: [] };
    }
    if (!linked.some((id) => id.trim() === normalizedTeam)) {
      return { blocked: false, nonReadyFiles: [] };
    }
    const stats = await getXaiCollectionById(normalizedTeam);
    return evaluateTeamKbXaiStatsForScopeReadiness(stats);
  } catch (error) {
    console.warn("[rag-readiness] team KB xAI collection read failed; not blocking collection search", {
      message: error instanceof Error ? error.message : String(error)
    });
    return { blocked: false, nonReadyFiles: [] };
  }
}

/** Maps xAI collection stats to the same summary shape used for xChat gating (unit-tested). */
export function evaluateTeamKbXaiStatsForScopeReadiness(stats: XaiCollectionStats): RagScopeReadinessSummary {
  const checkedAt = new Date().toISOString();
  const id = stats.id;
  const raw = stats.indexStatus?.trim() ?? "";
  const status = raw.toLowerCase();

  if (!status) {
    return { blocked: false, nonReadyFiles: [] };
  }

  if (/\b(ready|complete|completed|indexed|active)\b/.test(status)) {
    return { blocked: false, nonReadyFiles: [] };
  }

  if (/(failed|failure|\berror\b|\bfail\b)/.test(status)) {
    return {
      blocked: true,
      nonReadyFiles: [
        {
          fileId: id,
          readiness: "embedding_failed",
          processingStatus: "failed",
          message: `Team KB index status: ${stats.indexStatus}`,
          checkedAt
        }
      ]
    };
  }

  if (/\b(processing|running)\b/.test(status)) {
    return {
      blocked: true,
      nonReadyFiles: [
        {
          fileId: id,
          readiness: "processing_embeddings",
          processingStatus: "processing",
          message: `Team KB index status: ${stats.indexStatus}`,
          checkedAt
        }
      ]
    };
  }

  if (/\b(pending|queued|embedding)\b/.test(status)) {
    return {
      blocked: true,
      nonReadyFiles: [
        {
          fileId: id,
          readiness: "pending_embeddings",
          processingStatus: "pending",
          message: `Team KB index status: ${stats.indexStatus}`,
          checkedAt
        }
      ]
    };
  }

  return { blocked: false, nonReadyFiles: [] };
}

function normalizeProcessingStatus(value: RagSourceFile["xaiProcessingStatus"]): XaiFileProcessingStatus {
  if (!value) {
    return "unknown";
  }
  return value;
}
