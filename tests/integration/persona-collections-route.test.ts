import { NextResponse } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const apiAuthMocks = vi.hoisted(() => ({
  requireAdminSession: vi.fn()
}));

const xaiMocks = vi.hoisted(() => ({
  listXaiCollections: vi.fn(),
  createXaiCollection: vi.fn()
}));

const auditMocks = vi.hoisted(() => ({
  createAuditEvent: vi.fn()
}));

vi.mock("@/lib/api-auth", () => apiAuthMocks);
vi.mock("@/lib/xai", () => xaiMocks);
vi.mock("@/modules/audit/repository", () => auditMocks);

import {
    GET as getPersonaCollectionsInventory,
    POST as postPersonaCollection
} from "@/app/api/personas/collections/route";

describe("persona collections inventory route", () => {
  beforeEach(() => {
    apiAuthMocks.requireAdminSession.mockResolvedValue({
      userId: "507f1f77bcf86cd799439011",
      roles: ["global_admin"]
    });
    xaiMocks.listXaiCollections.mockResolvedValue([
      {
        id: "collection_beta",
        name: "Beta KB",
        documentCount: 19,
        chunkCount: 120,
        fileCount: 19,
        indexStatus: "indexed",
        lastSyncedAt: "2026-03-13T15:00:00.000Z",
        createdAt: "2026-03-12T10:00:00.000Z",
        updatedAt: "2026-03-14T10:00:00.000Z",
        usageStats: { query_count: 3 }
      },
      {
        id: "collection_alpha"
      }
    ]);
    xaiMocks.createXaiCollection.mockResolvedValue({
      id: "collection_created",
      name: "Created KB"
    });
    auditMocks.createAuditEvent.mockResolvedValue(undefined);
  });

  it("returns normalized collection inventory for admin", async () => {
    const response = await getPersonaCollectionsInventory();
    const payload = (await response.json()) as {
      data: Array<{
        id: string;
        name?: string;
        stats: {
          documentCount: number | null;
          chunkCount: number | null;
          fileCount: number | null;
          indexStatus: string | null;
          lastSyncedAt: string | null;
          createdAt: string | null;
          updatedAt: string | null;
          usageStats: Record<string, unknown> | null;
        };
      }>;
    };

    expect(response.status).toBe(200);
    expect(apiAuthMocks.requireAdminSession).toHaveBeenCalledTimes(1);
    expect(payload.data).toHaveLength(2);
    expect(payload.data).toEqual(
      expect.arrayContaining([
        {
          id: "collection_alpha",
          name: undefined,
          stats: {
            documentCount: null,
            chunkCount: null,
            fileCount: null,
            indexStatus: null,
            lastSyncedAt: null,
            createdAt: null,
            updatedAt: null,
            usageStats: null
          }
        },
        {
          id: "collection_beta",
          name: "Beta KB",
          stats: {
            documentCount: 19,
            chunkCount: 120,
            fileCount: 19,
            indexStatus: "indexed",
            lastSyncedAt: "2026-03-13T15:00:00.000Z",
            createdAt: "2026-03-12T10:00:00.000Z",
            updatedAt: "2026-03-14T10:00:00.000Z",
            usageStats: { query_count: 3 }
          }
        }
      ])
    );
  });

  it("returns empty inventory when xAI returns no collections", async () => {
    xaiMocks.listXaiCollections.mockResolvedValueOnce([]);
    const response = await getPersonaCollectionsInventory();
    const payload = (await response.json()) as { data: unknown[] };

    expect(response.status).toBe(200);
    expect(payload.data).toEqual([]);
  });

  it("returns auth response when unauthorized", async () => {
    apiAuthMocks.requireAdminSession.mockResolvedValueOnce(
      NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    );

    const response = await getPersonaCollectionsInventory();
    expect(response.status).toBe(401);
  });

  it("returns auth response for create when unauthorized", async () => {
    apiAuthMocks.requireAdminSession.mockResolvedValueOnce(
      NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    );

    const response = await postPersonaCollection(
      new Request("http://test/api/personas/collections", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "Created KB" })
      })
    );
    expect(response.status).toBe(401);
  });

  it("maps xAI failures to stable upstream error", async () => {
    xaiMocks.listXaiCollections.mockRejectedValueOnce(new Error("xai timeout"));

    const response = await getPersonaCollectionsInventory();
    const payload = (await response.json()) as { error: string; code: string };

    expect(response.status).toBe(502);
    expect(payload.error).toBe("Failed to load xAI collection inventory");
    expect(payload.code).toBe("upstream_error");
  });

  it("returns missing key code for management key misconfiguration", async () => {
    xaiMocks.listXaiCollections.mockRejectedValueOnce(new Error("Missing XAI_MANAGEMENT_API_KEY"));

    const response = await getPersonaCollectionsInventory();
    const payload = (await response.json()) as { error: string; code: string };

    expect(response.status).toBe(502);
    expect(payload.error).toBe("Failed to load xAI collection inventory");
    expect(payload.code).toBe("missing_management_key");
  });

  it("returns unauthorized code when management API rejects auth", async () => {
    xaiMocks.listXaiCollections.mockRejectedValueOnce(
      new Error('xAI collections list failed: {"status":401,"message":"Unauthorized"}')
    );

    const response = await getPersonaCollectionsInventory();
    const payload = (await response.json()) as { error: string; code: string };

    expect(response.status).toBe(502);
    expect(payload.error).toBe("Failed to load xAI collection inventory");
    expect(payload.code).toBe("upstream_unauthorized");
  });

  it("creates xAI collection for onboarding", async () => {
    const response = await postPersonaCollection(
      new Request("http://test/api/personas/collections", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "Created KB" })
      })
    );
    const payload = (await response.json()) as {
      data: {
        id: string;
        name: string;
        stats: {
          documentCount: null;
          chunkCount: null;
          fileCount: null;
          indexStatus: null;
          lastSyncedAt: null;
          createdAt: null;
          updatedAt: null;
          usageStats: null;
        };
      };
    };

    expect(response.status).toBe(200);
    expect(xaiMocks.createXaiCollection).toHaveBeenCalledWith("Created KB");
    expect(auditMocks.createAuditEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        entityType: "xpersona",
        entityId: "collection_created",
        action: "collection_created",
        actor: {
          userId: "507f1f77bcf86cd799439011",
          email: undefined,
          username: undefined
        }
      })
    );
    expect(payload.data).toEqual({
      id: "collection_created",
      name: "Created KB",
      stats: {
        documentCount: null,
        chunkCount: null,
        fileCount: null,
        indexStatus: null,
        lastSyncedAt: null,
        createdAt: null,
        updatedAt: null,
        usageStats: null
      }
    });
  });

  it("rejects invalid create collection payload", async () => {
    const response = await postPersonaCollection(
      new Request("http://test/api/personas/collections", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "a" })
      })
    );

    const payload = (await response.json()) as { code: string };
    expect(response.status).toBe(400);
    expect(payload.code).toBe("validation_error");
    expect(xaiMocks.createXaiCollection).not.toHaveBeenCalled();
  });

  it("rejects invalid json for create collection", async () => {
    const response = await postPersonaCollection(
      new Request("http://test/api/personas/collections", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "{"
      })
    );
    const payload = (await response.json()) as { code: string };

    expect(response.status).toBe(400);
    expect(payload.code).toBe("invalid_json");
  });

  it("rejects oversized create collection payload", async () => {
    const response = await postPersonaCollection(
      new Request("http://test/api/personas/collections", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Content-Length": "40000"
        },
        body: JSON.stringify({ name: "Created KB" })
      })
    );
    const payload = (await response.json()) as { code: string };

    expect(response.status).toBe(413);
    expect(payload.code).toBe("payload_too_large");
  });

  it("returns unauthorized code when create is rejected by management API", async () => {
    xaiMocks.createXaiCollection.mockRejectedValueOnce(
      new Error('xAI collection create failed: {"status":401,"message":"Unauthorized"}')
    );

    const response = await postPersonaCollection(
      new Request("http://test/api/personas/collections", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "Created KB" })
      })
    );
    const payload = (await response.json()) as { error: string; code: string };

    expect(response.status).toBe(502);
    expect(payload.error).toBe("Failed to create xAI collection");
    expect(payload.code).toBe("upstream_unauthorized");
  });

  it("does not fail create when audit write fails", async () => {
    auditMocks.createAuditEvent.mockRejectedValueOnce(new Error("audit unavailable"));
    const response = await postPersonaCollection(
      new Request("http://test/api/personas/collections", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "Created KB" })
      })
    );

    expect(response.status).toBe(200);
    expect(auditMocks.createAuditEvent).toHaveBeenCalledTimes(1);
  });
});
