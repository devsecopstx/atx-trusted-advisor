import { NextResponse } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const authMocks = vi.hoisted(() => ({
  requireSessionUser: vi.fn()
}));

const bootstrapMocks = vi.hoisted(() => ({
  resolveOrCreateUserBootstrapCollection: vi.fn()
}));

const settingsMocks = vi.hoisted(() => ({
  getUserAdminSettings: vi.fn()
}));

const repositoryMocks = vi.hoisted(() => ({
  resolveDefaultXchatPersonaForSession: vi.fn(),
  getPersonaById: vi.fn()
}));

vi.mock("@/lib/auth", () => authMocks);
vi.mock("@/modules/core-admin/access-request-bootstrap", () => bootstrapMocks);
vi.mock("@/modules/core-admin/repository", () => settingsMocks);
vi.mock("@/modules/xchat/repository", () => repositoryMocks);

import { GET as getCollections } from "@/app/api/xchat/collections/route";
import { ATXFINANCE_COLLECTION_ID } from "@/modules/xchat/types";

describe("xchat collections route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authMocks.requireSessionUser.mockResolvedValue({
      userId: "507f1f77bcf86cd799439011",
      tenantId: "507f1f77bcf86cd799439022",
      roles: ["viewer"]
    });
    bootstrapMocks.resolveOrCreateUserBootstrapCollection.mockResolvedValue({
      collectionId: "collection_user_history",
      collectionName: "User History"
    });
    settingsMocks.getUserAdminSettings.mockResolvedValue({
      assignedPersonaId: "507f1f77bcf86cd799439055"
    });
    repositoryMocks.resolveDefaultXchatPersonaForSession.mockResolvedValue({
      name: "xFinance"
    });
    repositoryMocks.getPersonaById.mockResolvedValue({
      status: "published",
      name: "xFinance",
      xaiCollection: {
        collectionId: "collection_assigned_persona",
        collectionName: "Assigned Persona Collection"
      }
    });
  });

  it("returns finance default + user history + assigned persona collection", async () => {
    const response = await getCollections();
    const payload = (await response.json()) as {
      data: Array<{ collectionId: string; source: string }>;
      metadata?: { activePersonaName?: string };
    };

    expect(response.status).toBe(200);
    expect(payload.metadata?.activePersonaName).toBe("xFinance");
    expect(payload.data).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          collectionId: ATXFINANCE_COLLECTION_ID,
          source: "atxfinance_default"
        }),
        expect.objectContaining({
          collectionId: "collection_user_history",
          source: "user_history"
        }),
        expect.objectContaining({
          collectionId: "collection_assigned_persona",
          source: "assigned_persona"
        })
      ])
    );
  });

  it("keeps default persona visible when assigned persona is not published", async () => {
    repositoryMocks.getPersonaById.mockResolvedValueOnce({
      status: "draft",
      name: "Draft Persona",
      xaiCollection: {
        collectionId: "collection_draft",
        collectionName: "Draft Collection"
      }
    });

    const response = await getCollections();
    const payload = (await response.json()) as {
      metadata?: { activePersonaName?: string };
    };

    expect(response.status).toBe(200);
    expect(payload.metadata?.activePersonaName).toBe("xFinance");
  });

  it("returns auth response when unauthenticated", async () => {
    authMocks.requireSessionUser.mockResolvedValueOnce(
      NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    );
    const response = await getCollections();
    expect(response.status).toBe(401);
  });

  it("gracefully returns defaults when user collection resolve/create fails", async () => {
    bootstrapMocks.resolveOrCreateUserBootstrapCollection.mockRejectedValueOnce(
      new Error("xai unavailable")
    );

    const response = await getCollections();
    const payload = (await response.json()) as {
      data: Array<{ collectionId: string; source: string }>;
      metadata?: { associatedCollectionCount?: number };
    };

    expect(response.status).toBe(200);
    expect(payload.data).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          collectionId: ATXFINANCE_COLLECTION_ID,
          source: "atxfinance_default"
        })
      ])
    );
    expect(payload.data).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          source: "user_history"
        })
      ])
    );
    expect(payload.metadata?.associatedCollectionCount).toBeGreaterThanOrEqual(1);
  });
});
