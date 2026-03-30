import { NextResponse } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const authMocks = vi.hoisted(() => ({
  requireAdminSession: vi.fn()
}));

const coreAdminRepositoryMocks = vi.hoisted(() => ({
  getUserAdminSettings: vi.fn(),
  upsertUserAdminSettings: vi.fn()
}));

const bootstrapMocks = vi.hoisted(() => ({
  getUserBootstrapCollectionByUserId: vi.fn()
}));

const identityMocks = vi.hoisted(() => ({
  getCoreUserById: vi.fn()
}));

const xchatRepositoryMocks = vi.hoisted(() => ({
  getPersonaById: vi.fn()
}));

const auditMocks = vi.hoisted(() => ({
  createAuditEvent: vi.fn()
}));

const teamXaiMocks = vi.hoisted(() => ({
  resolveTeamKbCollectionId: vi.fn()
}));

vi.mock("@/lib/api-auth", () => authMocks);
vi.mock("@/modules/core-admin/repository", () => coreAdminRepositoryMocks);
vi.mock("@/modules/core-admin/access-request-bootstrap", () => bootstrapMocks);
vi.mock("@/modules/identity/repository", () => identityMocks);
vi.mock("@/modules/xchat/repository", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/modules/xchat/repository")>();
  return { ...actual, ...xchatRepositoryMocks };
});
vi.mock("@/modules/audit/repository", () => auditMocks);
vi.mock("@/modules/xchat/team-xai-collection", () => ({
  resolveTeamKbCollectionId: teamXaiMocks.resolveTeamKbCollectionId
}));

import { GET, PUT } from "@/app/api/admin/users/[userId]/settings/route";
import type { UserAdminSettings } from "@/modules/core-admin/types";

const TEAM_DEFAULT_COLLECTION_ID = "collection_integration_team_default";

describe("admin user settings route", () => {
  beforeEach(() => {
    teamXaiMocks.resolveTeamKbCollectionId.mockResolvedValue(TEAM_DEFAULT_COLLECTION_ID);
    authMocks.requireAdminSession.mockResolvedValue({
      userId: "507f1f77bcf86cd799439011",
      tenantId: "507f1f77bcf86cd799439022",
      email: "admin@atxfinance.ai",
      username: "xf-admin",
      roles: ["global_admin"]
    });
    coreAdminRepositoryMocks.getUserAdminSettings.mockResolvedValue({
      userId: "507f1f77bcf86cd799439033",
      assignedPersonaId: "507f1f77bcf86cd799439055",
      broker: { provider: "paper", accountRef: "paper-main", enabled: true },
      portfolio: {
        riskProfile: "balanced",
        investmentStrategy: "balanced",
        baseCurrency: "USD",
        rebalanceFrequencyDays: 14
      },
      account: { accountStatus: "active", maxConcurrentSessions: 2, timezone: "America/New_York" },
      notificationDefaults: { email: true, push: true, sms: false, digestHourUTC: 13 },
      updatedAt: new Date("2026-03-20T00:00:00.000Z")
    });
    coreAdminRepositoryMocks.upsertUserAdminSettings.mockResolvedValue({
      userId: "507f1f77bcf86cd799439033",
      assignedPersonaId: "507f1f77bcf86cd799439055",
      broker: { provider: "paper", accountRef: "paper-main", enabled: true },
      portfolio: {
        riskProfile: "balanced",
        investmentStrategy: "balanced",
        baseCurrency: "USD",
        rebalanceFrequencyDays: 14
      },
      account: { accountStatus: "active", maxConcurrentSessions: 2, timezone: "America/New_York" },
      notificationDefaults: { email: true, push: true, sms: false, digestHourUTC: 13 },
      updatedAt: new Date("2026-03-20T00:00:00.000Z")
    });
    bootstrapMocks.getUserBootstrapCollectionByUserId.mockResolvedValue({
      collectionId: "collection_user_bootstrap",
      collectionName: "User Bootstrap"
    });
    identityMocks.getCoreUserById.mockResolvedValue({
      _id: { toHexString: () => "507f1f77bcf86cd799439033" },
      roles: ["viewer"]
    });
    xchatRepositoryMocks.getPersonaById.mockResolvedValue({
      _id: { toHexString: () => "507f1f77bcf86cd799439055" },
      status: "published",
      xaiCollection: {
        collectionId: "collection_persona_linked",
        collectionName: "Persona Linked Collection"
      }
    });
    auditMocks.createAuditEvent.mockResolvedValue(undefined);
  });

  it("GET returns settings and linked collection metadata", async () => {
    const response = await GET(new Request("http://test"), {
      params: Promise.resolve({ userId: "507f1f77bcf86cd799439033" })
    });
    const payload = (await response.json()) as {
      data: { assignedPersonaId?: string };
      metadata: {
        linkedCollections: Array<{ collectionId: string; source: string }>;
      };
    };

    expect(response.status).toBe(200);
    expect(payload.data.assignedPersonaId).toBe("507f1f77bcf86cd799439055");
    expect(
      (payload.data as { portfolio?: { investmentStrategy?: string } }).portfolio?.investmentStrategy
    ).toBe("balanced");
    expect(payload.metadata.linkedCollections).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          collectionId: TEAM_DEFAULT_COLLECTION_ID,
          source: "atxfinance_default"
        }),
        expect.objectContaining({
          collectionId: "collection_user_bootstrap",
          source: "user_bootstrap"
        }),
        expect.objectContaining({
          collectionId: "collection_persona_linked",
          source: "assigned_persona"
        })
      ])
    );
  });

  it("GET defaults investmentStrategy to balanced when missing on stored portfolio", async () => {
    coreAdminRepositoryMocks.getUserAdminSettings.mockResolvedValueOnce({
      userId: "507f1f77bcf86cd799439033",
      assignedPersonaId: "507f1f77bcf86cd799439055",
      broker: { provider: "paper", accountRef: "paper-main", enabled: true },
      portfolio: {
        riskProfile: "growth",
        baseCurrency: "USD",
        rebalanceFrequencyDays: 14
      },
      account: { accountStatus: "active", maxConcurrentSessions: 2, timezone: "America/New_York" },
      notificationDefaults: { email: true, push: true, sms: false, digestHourUTC: 13 },
      updatedAt: new Date("2026-03-20T00:00:00.000Z")
    } as UserAdminSettings);

    const response = await GET(new Request("http://test"), {
      params: Promise.resolve({ userId: "507f1f77bcf86cd799439033" })
    });
    const payload = (await response.json()) as {
      data: { portfolio: { investmentStrategy: string } };
    };

    expect(response.status).toBe(200);
    expect(payload.data.portfolio.investmentStrategy).toBe("balanced");
  });

  it("PUT allows persona assignment regardless of target user platform role", async () => {
    identityMocks.getCoreUserById.mockResolvedValueOnce({
      _id: { toHexString: () => "507f1f77bcf86cd799439033" },
      roles: ["global_admin"]
    });
    xchatRepositoryMocks.getPersonaById.mockResolvedValueOnce({
      _id: { toHexString: () => "507f1f77bcf86cd799439055" },
      status: "published",
      xaiCollection: {
        collectionId: "collection_persona_linked",
        collectionName: "Persona Linked Collection"
      }
    });

    const response = await PUT(
      new Request("http://test", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          assignedPersonaId: "507f1f77bcf86cd799439055",
          broker: { provider: "paper", accountRef: "paper-main", enabled: true },
          portfolio: {
            riskProfile: "balanced",
            investmentStrategy: "balanced",
            baseCurrency: "USD",
            rebalanceFrequencyDays: 14
          },
          account: { accountStatus: "active", maxConcurrentSessions: 2, timezone: "America/New_York" },
          notificationDefaults: { email: true, push: true, sms: false, digestHourUTC: 13 }
        })
      }),
      {
        params: Promise.resolve({ userId: "507f1f77bcf86cd799439033" })
      }
    );

    expect(response.status).toBe(200);
    expect(coreAdminRepositoryMocks.upsertUserAdminSettings).toHaveBeenCalled();
  });

  it("PUT rejects non-published persona assignment", async () => {
    xchatRepositoryMocks.getPersonaById.mockResolvedValueOnce({
      _id: { toHexString: () => "507f1f77bcf86cd799439055" },
      status: "draft"
    });

    const response = await PUT(
      new Request("http://test", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          assignedPersonaId: "507f1f77bcf86cd799439055",
          broker: { provider: "paper", accountRef: "paper-main", enabled: true },
          portfolio: {
            riskProfile: "balanced",
            investmentStrategy: "balanced",
            baseCurrency: "USD",
            rebalanceFrequencyDays: 14
          },
          account: { accountStatus: "active", maxConcurrentSessions: 2, timezone: "America/New_York" },
          notificationDefaults: { email: true, push: true, sms: false, digestHourUTC: 13 }
        })
      }),
      {
        params: Promise.resolve({ userId: "507f1f77bcf86cd799439033" })
      }
    );
    const payload = (await response.json()) as { code: string };

    expect(response.status).toBe(400);
    expect(payload.code).toBe("assigned_persona_not_published");
  });

  it("returns auth response when requester is not admin", async () => {
    authMocks.requireAdminSession.mockResolvedValueOnce(
      NextResponse.json({ error: "Forbidden" }, { status: 403 })
    );
    const response = await GET(new Request("http://test"), {
      params: Promise.resolve({ userId: "507f1f77bcf86cd799439033" })
    });
    expect(response.status).toBe(403);
  });
});
