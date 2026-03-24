import { describe, expect, it } from "vitest";

import type { XaiCollectionStats } from "@/lib/xai";
import { evaluateTeamKbXaiStatsForScopeReadiness } from "@/modules/xchat/rag-file-readiness";

function stats(partial: Partial<XaiCollectionStats> & { id: string }): XaiCollectionStats {
  return {
    id: partial.id,
    name: partial.name,
    documentCount: partial.documentCount,
    chunkCount: partial.chunkCount,
    fileCount: partial.fileCount,
    indexStatus: partial.indexStatus,
    createdAt: partial.createdAt,
    updatedAt: partial.updatedAt
  };
}

describe("evaluateTeamKbXaiStatsForScopeReadiness", () => {
  it("does not block when indexStatus is absent", () => {
    const out = evaluateTeamKbXaiStatsForScopeReadiness(stats({ id: "col_1" }));
    expect(out).toEqual({ blocked: false, nonReadyFiles: [] });
  });

  it("does not block for ready-like indexStatus values", () => {
    for (const indexStatus of ["ready", "indexed", "ACTIVE", "completed"]) {
      const out = evaluateTeamKbXaiStatsForScopeReadiness(
        stats({ id: "col_x", indexStatus })
      );
      expect(out.blocked, indexStatus).toBe(false);
      expect(out.nonReadyFiles).toHaveLength(0);
    }
  });

  it("blocks with failed readiness for error-like indexStatus", () => {
    const out = evaluateTeamKbXaiStatsForScopeReadiness(
      stats({ id: "col_fail", indexStatus: "embedding_failed" })
    );
    expect(out.blocked).toBe(true);
    expect(out.nonReadyFiles).toHaveLength(1);
    expect(out.nonReadyFiles[0]?.readiness).toBe("embedding_failed");
    expect(out.nonReadyFiles[0]?.processingStatus).toBe("failed");
  });

  it("blocks with processing_embeddings for processing-like indexStatus", () => {
    const out = evaluateTeamKbXaiStatsForScopeReadiness(
      stats({ id: "col_p", indexStatus: "processing" })
    );
    expect(out.blocked).toBe(true);
    expect(out.nonReadyFiles[0]?.readiness).toBe("processing_embeddings");
    expect(out.nonReadyFiles[0]?.processingStatus).toBe("processing");
  });

  it("blocks with pending_embeddings for pending-like indexStatus", () => {
    const out = evaluateTeamKbXaiStatsForScopeReadiness(
      stats({ id: "col_q", indexStatus: "pending" })
    );
    expect(out.blocked).toBe(true);
    expect(out.nonReadyFiles[0]?.readiness).toBe("pending_embeddings");
    expect(out.nonReadyFiles[0]?.processingStatus).toBe("pending");
  });

  it("does not block for unknown indexStatus strings", () => {
    const out = evaluateTeamKbXaiStatsForScopeReadiness(
      stats({ id: "col_u", indexStatus: "custom_vendor_state" })
    );
    expect(out.blocked).toBe(false);
  });
});
