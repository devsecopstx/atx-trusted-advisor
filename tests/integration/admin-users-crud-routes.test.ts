import { NextResponse } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const authMocks = vi.hoisted(() => ({
  requireAdminSession: vi.fn()
}));

const identityMocks = vi.hoisted(() => ({
  listCoreUsers: vi.fn(),
  createCoreUser: vi.fn(),
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

vi.mock("@/lib/api-auth", () => authMocks);
vi.mock("@/modules/identity/repository", () => identityMocks);
vi.mock("@/modules/audit/repository", () => auditMocks);

import { GET as getUsers, POST as postUser } from "@/app/api/admin/users/route";
import {
  DELETE as deleteUser,
  GET as getUser,
  PUT as putUser
} from "@/app/api/admin/users/[userId]/route";

describe("admin users CRUD routes", () => {
  beforeEach(() => {
    authMocks.requireAdminSession.mockResolvedValue({
      userId: "507f1f77bcf86cd799439011",
      tenantId: "507f1f77bcf86cd799439022",
      roles: ["global_admin"]
    });
    identityMocks.listCoreUsers.mockResolvedValue([
      {
        _id: { toHexString: () => "507f1f77bcf86cd799439033" },
        email: "user@atxfinance.ai",
        roles: ["viewer"],
        subscriptionPlan: "free",
        status: "active",
        createdAt: new Date("2026-03-16T00:00:00.000Z"),
        updatedAt: new Date("2026-03-16T00:00:00.000Z")
      }
    ]);
    identityMocks.createCoreUser.mockResolvedValue({
      _id: { toHexString: () => "507f1f77bcf86cd799439044" },
      email: "new@atxfinance.ai",
      roles: ["viewer"],
      subscriptionPlan: "free",
      status: "active",
      createdAt: new Date("2026-03-16T00:00:00.000Z"),
      updatedAt: new Date("2026-03-16T00:00:00.000Z")
    });
    identityMocks.getCoreUserById.mockResolvedValue({
      _id: { toHexString: () => "507f1f77bcf86cd799439033" },
      email: "user@atxfinance.ai",
      roles: ["viewer"],
      subscriptionPlan: "free",
      status: "active",
      createdAt: new Date("2026-03-16T00:00:00.000Z"),
      updatedAt: new Date("2026-03-16T00:00:00.000Z")
    });
    identityMocks.updateCoreUserById.mockResolvedValue({
      _id: { toHexString: () => "507f1f77bcf86cd799439033" },
      email: "updated@atxfinance.ai",
      roles: ["advisor"],
      subscriptionPlan: "pro",
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
    const payload = (await response.json()) as { data: Array<{ email: string }> };
    expect(response.status).toBe(200);
    expect(payload.data[0]?.email).toBe("user@atxfinance.ai");
    expect(identityMocks.listCoreUsers).toHaveBeenCalledWith(50);
  });

  it("creates user", async () => {
    const response = await postUser(
      new Request("http://test/api/admin/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: "new@atxfinance.ai",
          role: "viewer",
          subscriptionPlan: "free",
          status: "active"
        })
      })
    );
    expect(response.status).toBe(201);
    expect(identityMocks.createCoreUser).toHaveBeenCalledTimes(1);
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
          subscriptionPlan: "pro"
        })
      }),
      {
        params: Promise.resolve({ userId: "507f1f77bcf86cd799439033" })
      }
    );
    expect(response.status).toBe(200);
    expect(identityMocks.updateCoreUserById).toHaveBeenCalledTimes(1);
  });

  it("deletes user by id", async () => {
    const response = await deleteUser(new Request("http://test"), {
      params: Promise.resolve({ userId: "507f1f77bcf86cd799439033" })
    });
    expect(response.status).toBe(200);
    expect(identityMocks.deleteCoreUserById).toHaveBeenCalledTimes(1);
  });

  it("returns auth response for non-admin", async () => {
    authMocks.requireAdminSession.mockResolvedValueOnce(
      NextResponse.json({ error: "Forbidden" }, { status: 403 })
    );
    const response = await getUsers(new Request("http://test/api/admin/users"));
    expect(response.status).toBe(403);
  });
});
