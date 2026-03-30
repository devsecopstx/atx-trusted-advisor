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

const teamXaiMocks = vi.hoisted(() => ({
  resolveTeamKbCollectionId: vi.fn()
}));

vi.mock("@/lib/auth", () => authMocks);
vi.mock("@/modules/core-admin/access-request-bootstrap", () => bootstrapMocks);
vi.mock("@/modules/core-admin/repository", () => settingsMocks);
vi.mock("@/modules/xchat/repository", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/modules/xchat/repository")>();
  return { ...actual, ...repositoryMocks };
});
vi.mock("@/modules/xchat/team-xai-collection", () => ({
  resolveTeamKbCollectionId: teamXaiMocks.resolveTeamKbCollectionId
}));

import { GET as getCollections } from "@/app/api/xchat/collections/route";

const TEAM_DEFAULT_COLLECTION_ID = "collection_integration_team_default";

describe("xchat collections route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    teamXaiMocks.resolveTeamKbCollectionId.mockResolvedValue(TEAM_DEFAULT_COLLECTION_ID);
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
      name: "atx-trusted-advisor"
    });
    repositoryMocks.getPersonaById.mockResolvedValue({
      status: "published",
      name: "atx-trusted-advisor",
      teamCollection: {
        collectionId: "collection_assigned_team",
        collectionName: "Assigned Team KB"
      },
      xaiCollection: {
        collectionId: "collection_assigned_persona",
        collectionName: "Assigned Persona Collection"
      }
    });
  });

  it("returns finance default + assigned team collection (no per-user history by default)", async () => {
    const response = await getCollections();
    const payload = (await response.json()) as {
      data: Array<{ collectionId: string; source: string }>;
      metadata?: { activePersonaName?: string; assignedPersonaId?: string | null };
    };

    expect(response.status).toBe(200);
    expect(payload.metadata?.activePersonaName).toBe("atx-trusted-advisor");
    expect(payload.metadata?.assignedPersonaId).toBe("507f1f77bcf86cd799439055");
    expect(payload.data).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          collectionId: TEAM_DEFAULT_COLLECTION_ID,
          source: "atxfinance_default"
        }),
        expect.objectContaining({
          collectionId: "collection_assigned_team",
          source: "assigned_persona"
        })
      ])
    );
    expect(payload.data).not.toEqual(
      expect.arrayContaining([expect.objectContaining({ source: "user_history" })])
    );
    expect(bootstrapMocks.resolveOrCreateUserBootstrapCollection).not.toHaveBeenCalled();
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
      metadata?: { activePersonaName?: string; assignedPersonaId?: string | null };
    };

    expect(response.status).toBe(200);
    expect(payload.metadata?.activePersonaName).toBe("atx-trusted-advisor");
    expect(payload.metadata?.assignedPersonaId).toBeNull();
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
          collectionId: TEAM_DEFAULT_COLLECTION_ID,
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
