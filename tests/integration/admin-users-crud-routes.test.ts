import { NextResponse } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const authMocks = vi.hoisted(() => ({
  requireAdminSession: vi.fn()
}));

const identityMocks = vi.hoisted(() => ({
  listCoreUsers: vi.fn(),
  listAdminTenantMembershipsByUserIds: vi.fn().mockResolvedValue(new Map()),
  createCoreUser: vi.fn(),
  assertTenantHasRoomForAnotherUser: vi.fn().mockResolvedValue(undefined),
  upsertTenantMembership: vi.fn(),
  getCoreUserById: vi.fn(),
  updateCoreUserById: vi.fn(),
  deleteCoreUserById: vi.fn()
}));

const auditMocks = vi.hoisted(() => ({
  createAuditEvent: vi.fn(),
  listAuditEventsForEntity: vi.fn(),
  listLatestAuditEventsForEntities: vi.fn()
}));

const coreAdminRepoMocks = vi.hoisted(() => ({
  purgeAllDataAssociatedWithCoreUser: vi.fn().mockResolvedValue(undefined)
}));

const clearMeteredUsageMock = vi.hoisted(() =>
  vi.fn().mockResolvedValue({ xchatUsageDeleted: 2, featureDailyDeleted: 1 })
);

vi.mock("@/lib/api-auth", () => authMocks);
vi.mock("@/modules/xchat/clear-metered-usage-for-user", () => ({
  clearMeteredUsageForUser: clearMeteredUsageMock
}));
vi.mock("@/modules/identity/repository", () => identityMocks);
vi.mock("@/modules/audit/repository", () => auditMocks);
vi.mock("@/modules/core-admin/repository", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/modules/core-admin/repository")>();
  return {
    ...actual,
    purgeAllDataAssociatedWithCoreUser: coreAdminRepoMocks.purgeAllDataAssociatedWithCoreUser
  };
});

import { POST as postMeteredUsageReset } from "@/app/api/admin/users/[userId]/metered-usage/reset/route";
import {
    DELETE as deleteUser,
    GET as getUser,
    PUT as putUser
} from "@/app/api/admin/users/[userId]/route";
import { GET as getUsers, POST as postUser } from "@/app/api/admin/users/route";

describe("admin users CRUD routes", () => {
  beforeEach(() => {
    clearMeteredUsageMock.mockClear();
    clearMeteredUsageMock.mockResolvedValue({ xchatUsageDeleted: 2, featureDailyDeleted: 1 });
    authMocks.requireAdminSession.mockResolvedValue({
      userId: "507f1f77bcf86cd799439011",
      tenantId: "507f1f77bcf86cd799439022",
      roles: ["global_admin"]
    });
    identityMocks.listAdminTenantMembershipsByUserIds.mockResolvedValue(new Map());
    identityMocks.listCoreUsers.mockResolvedValue([
      {
        _id: { toHexString: () => "507f1f77bcf86cd799439033" },
        email: "user@atxfinance.ai",
        roles: ["viewer"],
        subscriptionPlan: "basic",
        status: "active",
        createdAt: new Date("2026-03-16T00:00:00.000Z"),
        updatedAt: new Date("2026-03-16T00:00:00.000Z")
      }
    ]);
    identityMocks.createCoreUser.mockResolvedValue({
      _id: { toHexString: () => "507f1f77bcf86cd799439044" },
      email: "new@atxfinance.ai",
      roles: ["viewer"],
      subscriptionPlan: "basic",
      status: "active",
      createdAt: new Date("2026-03-16T00:00:00.000Z"),
      updatedAt: new Date("2026-03-16T00:00:00.000Z")
    });
    identityMocks.getCoreUserById.mockResolvedValue({
      _id: { toHexString: () => "507f1f77bcf86cd799439033" },
      email: "user@atxfinance.ai",
      roles: ["viewer"],
      subscriptionPlan: "basic",
      status: "active",
      createdAt: new Date("2026-03-16T00:00:00.000Z"),
      updatedAt: new Date("2026-03-16T00:00:00.000Z")
    });
    identityMocks.updateCoreUserById.mockResolvedValue({
      _id: { toHexString: () => "507f1f77bcf86cd799439033" },
      email: "updated@atxfinance.ai",
      roles: ["advisor"],
      subscriptionPlan: "premium",
      status: "active",
      createdAt: new Date("2026-03-16T00:00:00.000Z"),
      updatedAt: new Date("2026-03-16T00:00:00.000Z")
    });
    identityMocks.deleteCoreUserById.mockResolvedValue(true);
    identityMocks.upsertTenantMembership.mockResolvedValue({
      _id: { toHexString: () => "507f1f77bcf86cd799439099" }
    });
    auditMocks.createAuditEvent.mockResolvedValue(undefined);
    auditMocks.listAuditEventsForEntity.mockResolvedValue([]);
    auditMocks.listLatestAuditEventsForEntities.mockResolvedValue({});
  });

  it("lists users", async () => {
    const response = await getUsers(new Request("http://test/api/admin/users?limit=50"));
    const payload = (await response.json()) as {
      data: Array<{ email: string; tenantMemberships: unknown[] }>;
    };
    expect(response.status).toBe(200);
    expect(payload.data[0]?.email).toBe("user@atxfinance.ai");
    expect(payload.data[0]?.tenantMemberships).toEqual([]);
    expect(identityMocks.listCoreUsers).toHaveBeenCalledWith(50);
    expect(identityMocks.listAdminTenantMembershipsByUserIds).toHaveBeenCalled();
  });

  it("creates user", async () => {
    const response = await postUser(
      new Request("http://test/api/admin/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: "new@atxfinance.ai",
          role: "viewer",
          subscriptionPlan: "basic",
          status: "active"
        })
      })
    );
    expect(response.status).toBe(201);
    expect(identityMocks.createCoreUser).toHaveBeenCalledTimes(1);
    expect(identityMocks.assertTenantHasRoomForAnotherUser).toHaveBeenCalled();
    expect(identityMocks.upsertTenantMembership).toHaveBeenCalled();
  });

  it("defaults new admin-created user role to operator", async () => {
    await postUser(
      new Request("http://test/api/admin/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: "new@atxfinance.ai",
          subscriptionPlan: "basic",
          status: "active"
        })
      })
    );
    expect(identityMocks.createCoreUser).toHaveBeenCalledWith(
      expect.objectContaining({
        email: "new@atxfinance.ai",
        role: "operator"
      })
    );
  });

  it("gets user by id", async () => {
    const response = await getUser(new Request("http://test"), {
      params: Promise.resolve({ userId: "507f1f77bcf86cd799439033" })
    });
    expect(response.status).toBe(200);
  });

  it("updates user by id", async () => {
    const response = await putUser(
      new Request("http://test", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: "updated@atxfinance.ai",
          role: "advisor",
          subscriptionPlan: "premium"
        })
      }),
      {
        params: Promise.resolve({ userId: "507f1f77bcf86cd799439033" })
      }
    );
    expect(response.status).toBe(200);
    expect(identityMocks.updateCoreUserById).toHaveBeenCalledTimes(1);
    expect(clearMeteredUsageMock).toHaveBeenCalledWith("507f1f77bcf86cd799439033");
  });

  it("does not clear metered usage when subscription plan is unchanged", async () => {
    identityMocks.updateCoreUserById.mockResolvedValueOnce({
      _id: { toHexString: () => "507f1f77bcf86cd799439033" },
      email: "updated2@atxfinance.ai",
      roles: ["advisor"],
      subscriptionPlan: "basic",
      status: "active",
      createdAt: new Date("2026-03-16T00:00:00.000Z"),
      updatedAt: new Date("2026-03-16T00:00:00.000Z")
    });
    const response = await putUser(
      new Request("http://test", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: "updated2@atxfinance.ai",
          role: "advisor",
          subscriptionPlan: "basic"
        })
      }),
      {
        params: Promise.resolve({ userId: "507f1f77bcf86cd799439033" })
      }
    );
    expect(response.status).toBe(200);
    expect(clearMeteredUsageMock).not.toHaveBeenCalled();
  });

  it("POST metered-usage reset clears usage and returns counts", async () => {
    const res = await postMeteredUsageReset(new Request("http://test"), {
      params: Promise.resolve({ userId: "507f1f77bcf86cd799439033" })
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      data: { userId: string; xchatUsageDeleted: number; featureDailyDeleted: number };
    };
    expect(body.data.userId).toBe("507f1f77bcf86cd799439033");
    expect(body.data.xchatUsageDeleted).toBe(2);
    expect(body.data.featureDailyDeleted).toBe(1);
    expect(clearMeteredUsageMock).toHaveBeenCalledWith("507f1f77bcf86cd799439033");
  });

  it("deletes user by id", async () => {
    const response = await deleteUser(new Request("http://test"), {
      params: Promise.resolve({ userId: "507f1f77bcf86cd799439033" })
    });
    expect(response.status).toBe(200);
    expect(identityMocks.getCoreUserById).toHaveBeenCalled();
    expect(coreAdminRepoMocks.purgeAllDataAssociatedWithCoreUser).toHaveBeenCalledWith({
      userIdHex: "507f1f77bcf86cd799439033",
      emailNormalized: "user@atxfinance.ai"
    });
    expect(identityMocks.deleteCoreUserById).toHaveBeenCalledTimes(1);
  });

  it("rejects delete when target is the signed-in admin (self)", async () => {
    const response = await deleteUser(new Request("http://test"), {
      params: Promise.resolve({ userId: "507f1f77bcf86cd799439011" })
    });
    expect(response.status).toBe(400);
    const body = (await response.json()) as { error?: string };
    expect(body.error).toMatch(/cannot delete your own account/i);
    expect(coreAdminRepoMocks.purgeAllDataAssociatedWithCoreUser).not.toHaveBeenCalled();
    expect(identityMocks.deleteCoreUserById).not.toHaveBeenCalled();
  });

  it("returns 404 when user does not exist before purge", async () => {
    identityMocks.getCoreUserById.mockResolvedValueOnce(null);
    const response = await deleteUser(new Request("http://test"), {
      params: Promise.resolve({ userId: "507f1f77bcf86cd799439033" })
    });
    expect(response.status).toBe(404);
    expect(coreAdminRepoMocks.purgeAllDataAssociatedWithCoreUser).not.toHaveBeenCalled();
    expect(identityMocks.deleteCoreUserById).not.toHaveBeenCalled();
  });

  it("returns auth response for non-admin", async () => {
    authMocks.requireAdminSession.mockResolvedValueOnce(
      NextResponse.json({ error: "Forbidden" }, { status: 403 })
    );
    const response = await getUsers(new Request("http://test/api/admin/users"));
    expect(response.status).toBe(403);
  });
});
