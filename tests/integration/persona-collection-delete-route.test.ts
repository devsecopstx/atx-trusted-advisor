import { NextResponse } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const apiAuthMocks = vi.hoisted(() => ({
  requireAdminSession: vi.fn()
}));

const xaiMocks = vi.hoisted(() => ({
  deleteXaiCollection: vi.fn(),
  getXaiCollectionById: vi.fn(),
  XaiCollectionNotFoundError: class extends Error {}
}));

const auditMocks = vi.hoisted(() => ({
  createAuditEvent: vi.fn()
}));

vi.mock("@/lib/api-auth", () => apiAuthMocks);
vi.mock("@/lib/xai", () => xaiMocks);
vi.mock("@/modules/audit/repository", () => auditMocks);

import { DELETE as deletePersonaCollection } from "@/app/api/personas/collections/[collectionId]/route";

describe("persona collection delete route", () => {
  beforeEach(() => {
    apiAuthMocks.requireAdminSession.mockResolvedValue({
      userId: "507f1f77bcf86cd799439011",
      roles: ["global_admin"],
      email: "admin@xfinance.dev",
      username: "admin"
    });
    xaiMocks.deleteXaiCollection.mockResolvedValue(undefined);
    auditMocks.createAuditEvent.mockResolvedValue(undefined);
  });

  it("deletes xAI collection for admin", async () => {
    const response = await deletePersonaCollection(new Request("http://test"), {
      params: Promise.resolve({ collectionId: "collection_123" })
    });
    const payload = (await response.json()) as { ok: boolean };

    expect(response.status).toBe(200);
    expect(payload.ok).toBe(true);
    expect(xaiMocks.deleteXaiCollection).toHaveBeenCalledWith("collection_123");
    expect(auditMocks.createAuditEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        entityType: "xpersona",
        entityId: "collection_123",
        action: "collection_deleted"
      })
    );
  });

  it("returns auth response when unauthorized", async () => {
    apiAuthMocks.requireAdminSession.mockResolvedValueOnce(
      NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    );

    const response = await deletePersonaCollection(new Request("http://test"), {
      params: Promise.resolve({ collectionId: "collection_123" })
    });
    expect(response.status).toBe(401);
  });

  it("returns not found when management api reports missing collection", async () => {
    xaiMocks.deleteXaiCollection.mockRejectedValueOnce(
      new Error('xAI collection delete failed: {"status":404,"message":"Not found"}')
    );

    const response = await deletePersonaCollection(new Request("http://test"), {
      params: Promise.resolve({ collectionId: "collection_404" })
    });
    const payload = (await response.json()) as { code: string };

    expect(response.status).toBe(404);
    expect(payload.code).toBe("upstream_not_found");
  });
});
