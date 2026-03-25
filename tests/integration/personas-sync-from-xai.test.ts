import { NextResponse } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const authMocks = vi.hoisted(() => ({
  requireAdminSession: vi.fn()
}));

const syncMocks = vi.hoisted(() => ({
  syncPersonasFromXaiCollection: vi.fn()
}));

vi.mock("@/lib/api-auth", () => ({
  requireAdminSession: authMocks.requireAdminSession
}));

vi.mock("@/modules/xchat/persona-sync-from-xai", () => ({
  syncPersonasFromXaiCollection: syncMocks.syncPersonasFromXaiCollection
}));

import { POST as postSyncFromXai } from "@/app/api/personas/sync-from-xai/route";

describe("POST /api/personas/sync-from-xai", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authMocks.requireAdminSession.mockResolvedValue({
      userId: "507f1f77bcf86cd799439011",
      tenantId: "507f1f77bcf86cd799439022",
      email: "admin@atxfinance.ai",
      username: "admin",
      roles: ["global_admin"]
    });
    syncMocks.syncPersonasFromXaiCollection.mockResolvedValue({
      collectionId: "collection_test",
      collectionDisplayName: "atx-trusted-advisor-dev-xpersonas",
      listed: 2,
      examined: 2,
      imported: 1,
      updated: 1,
      skipped: 0,
      syntheticFallbacks: 0,
      errors: []
    });
  });

  it("returns 200 with sync summary for global_admin", async () => {
    const res = await postSyncFromXai(
      new Request("http://localhost/api/personas/sync-from-xai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: "merge" })
      })
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      data: { imported: number; collectionDisplayName: string };
    };
    expect(body.data.imported).toBe(1);
    expect(body.data.collectionDisplayName).toContain("xpersonas");
    expect(syncMocks.syncPersonasFromXaiCollection).toHaveBeenCalledWith(
      expect.objectContaining({
        actorUserId: "507f1f77bcf86cd799439011",
        mode: "merge"
      })
    );
  });

  it("returns 401 when admin session is missing", async () => {
    authMocks.requireAdminSession.mockResolvedValueOnce(
      NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    );
    const res = await postSyncFromXai(
      new Request("http://localhost/api/personas/sync-from-xai", { method: "POST" })
    );
    expect(res.status).toBe(401);
    expect(syncMocks.syncPersonasFromXaiCollection).not.toHaveBeenCalled();
  });

  it("returns 404 when xAI collection is missing", async () => {
    const err = new Error('No xAI collection named "missing".');
    (err as Error & { code?: string }).code = "XAI_COLLECTION_NOT_FOUND";
    syncMocks.syncPersonasFromXaiCollection.mockRejectedValueOnce(err);
    const res = await postSyncFromXai(
      new Request("http://localhost/api/personas/sync-from-xai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ collectionDisplayName: "missing" })
      })
    );
    expect(res.status).toBe(404);
  });
});
