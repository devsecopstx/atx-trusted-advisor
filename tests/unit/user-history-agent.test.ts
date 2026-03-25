import { ObjectId } from "mongodb";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const bootstrapMocks = vi.hoisted(() => ({
  buildXchatTurnMarkdownPayload: vi.fn(),
  resolveOrCreateUserBootstrapCollection: vi.fn(),
  uploadBuiltXchatTurnToXaiCollection: vi.fn()
}));

vi.mock("@/modules/core-admin/access-request-bootstrap", () => bootstrapMocks);

const repoMocks = vi.hoisted(() => ({
  listXchatLogsPendingXaiSync: vi.fn(),
  markXchatLogXaiSynced: vi.fn(),
  markXchatLogXaiSyncFailed: vi.fn()
}));

vi.mock("@/modules/xchat/repository", () => repoMocks);

import { runUserHistoryAgent } from "@/modules/xchat/user-history-agent";

describe("runUserHistoryAgent", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.XCHAT_SYNC_TURNS_TO_USER_XAI_COLLECTION = "true";
  });

  afterEach(() => {
    delete process.env.XCHAT_SYNC_TURNS_TO_USER_XAI_COLLECTION;
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

  it("skips entirely when per-user xAI sync env is disabled", async () => {
    delete process.env.XCHAT_SYNC_TURNS_TO_USER_XAI_COLLECTION;
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
    expect(r.output).toContain("skipped");
    expect(repoMocks.listXchatLogsPendingXaiSync).not.toHaveBeenCalled();
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
