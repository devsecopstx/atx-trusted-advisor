import { ObjectId } from "mongodb";
import { beforeEach, describe, expect, it, vi } from "vitest";

const bootstrapMocks = vi.hoisted(() => ({
  buildXchatTurnMarkdownPayload: vi.fn(),
  resolveOrCreateUserBootstrapCollection: vi.fn(),
  uploadBuiltXchatTurnToXaiCollection: vi.fn()
}));

vi.mock("@/modules/core-admin/access-request-bootstrap", () => bootstrapMocks);

const repoMocks = vi.hoisted(() => ({
  listXchatLogsPendingXaiSync: vi.fn(),
  markXchatLogXaiSynced: vi.fn(),
  markXchatLogXaiSyncFailed: vi.fn(),
  markXchatLogXaiSyncSkippedNoLongTermConsent: vi.fn()
}));

vi.mock("@/modules/xchat/repository", () => repoMocks);

const prefsMocks = vi.hoisted(() => ({
  userHasLongTermXaiMemoryEnabled: vi.fn()
}));

vi.mock("@/modules/xchat/user-preferences-repository", () => prefsMocks);

import { runUserHistoryAgent } from "@/modules/xchat/user-history-agent";

describe("runUserHistoryAgent", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    prefsMocks.userHasLongTermXaiMemoryEnabled.mockResolvedValue(true);
  });

  it("returns success with zero pending", async () => {
    repoMocks.listXchatLogsPendingXaiSync.mockResolvedValueOnce([]);
    const task = {
      _id: new ObjectId(),
      tenantId: new ObjectId(),
      name: "user_history_agent",
      category: "user-history" as const,
      scheduleCron: "0 * * * *",
      enabled: true
    };
    const r = await runUserHistoryAgent(task);
    expect(r.status).toBe("success");
    expect(r.output).toContain("no pending");
  });

  it("marks consent skip when long-term xAI memory is disabled for user", async () => {
    prefsMocks.userHasLongTermXaiMemoryEnabled.mockResolvedValue(false);
    const logId = new ObjectId();
    const uid = new ObjectId();
    repoMocks.listXchatLogsPendingXaiSync.mockResolvedValueOnce([
      {
        _id: logId,
        userId: uid,
        tenantId: null,
        requestId: "r1",
        correlationId: "c1",
        message: "hi",
        response: "hello",
        model: "grok-test",
        personaName: "Ops",
        scope: "global",
        contextChunkIds: [],
        createdAt: new Date("2026-01-01T00:00:00.000Z"),
        retentionExpiresAt: new Date("2026-02-01T00:00:00.000Z")
      }
    ]);
    const task = {
      _id: new ObjectId(),
      tenantId: undefined,
      name: "user_history_agent",
      category: "user-history" as const,
      scheduleCron: "0 * * * *",
      enabled: true
    };
    const r = await runUserHistoryAgent(task);
    expect(r.status).toBe("success");
    expect(r.output).toContain("skipped_no_long_term_consent=1");
    expect(r.output).toContain("synced=0");
    expect(repoMocks.markXchatLogXaiSyncSkippedNoLongTermConsent).toHaveBeenCalledWith(logId);
    expect(bootstrapMocks.uploadBuiltXchatTurnToXaiCollection).not.toHaveBeenCalled();
  });

  it("syncs one log and marks synced", async () => {
    const logId = new ObjectId();
    const uid = new ObjectId();
    repoMocks.listXchatLogsPendingXaiSync.mockResolvedValueOnce([
      {
        _id: logId,
        userId: uid,
        tenantId: null,
        requestId: "r1",
        correlationId: "c1",
        message: "hi",
        response: "hello",
        model: "grok-test",
        personaName: "Ops",
        scope: "global",
        contextChunkIds: [],
        createdAt: new Date("2026-01-01T00:00:00.000Z"),
        retentionExpiresAt: new Date("2026-02-01T00:00:00.000Z")
      }
    ]);
    bootstrapMocks.resolveOrCreateUserBootstrapCollection.mockResolvedValueOnce({
      collectionId: "col_user",
      collectionName: "User"
    });
    bootstrapMocks.buildXchatTurnMarkdownPayload.mockReturnValueOnce({
      markdown: "# md",
      payloadHash: "hash1",
      retentionExpiresAt: new Date("2026-02-01T00:00:00.000Z"),
      filename: "f.md"
    });
    bootstrapMocks.uploadBuiltXchatTurnToXaiCollection.mockResolvedValueOnce({ fileId: "file_1" });

    const task = {
      _id: new ObjectId(),
      tenantId: undefined,
      name: "user_history_agent",
      category: "user-history" as const,
      scheduleCron: "0 * * * *",
      enabled: true
    };
    const r = await runUserHistoryAgent(task);
    expect(r.status).toBe("success");
    expect(r.output).toContain("synced=1");
    expect(bootstrapMocks.uploadBuiltXchatTurnToXaiCollection).toHaveBeenCalledWith(
      "col_user",
      expect.objectContaining({ markdown: "# md" })
    );
    expect(repoMocks.markXchatLogXaiSynced).toHaveBeenCalledWith(
      logId,
      expect.objectContaining({ xaiTurnFileId: "file_1", xaiTurnPayloadHash: "hash1" })
    );
  });
});
