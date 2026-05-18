import { ObjectId } from "mongodb";
import { NextResponse } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const authMocks = vi.hoisted(() => ({
  requireSessionUser: vi.fn()
}));

const identityMocks = vi.hoisted(() => ({
  getCoreUserById: vi.fn(),
  resolveTenantMembershipForSessionGrounding: vi.fn()
}));

const groundingCacheMocks = vi.hoisted(() => ({
  readSessionGroundingOkCached: vi.fn(async () => false),
  writeSessionGroundingOkCached: vi.fn(async () => undefined)
}));

vi.mock("@/lib/auth", () => authMocks);
vi.mock("@/modules/identity/repository", () => identityMocks);
vi.mock("@/modules/identity/session-grounding-decision-cache", () => groundingCacheMocks);

import { GET } from "@/app/api/internal/authz/session-grounding/route";

describe("internal session grounding route", () => {
  const uid = new ObjectId();
  const tid = new ObjectId();

  beforeEach(() => {
    vi.clearAllMocks();
    groundingCacheMocks.readSessionGroundingOkCached.mockResolvedValue(false);
    groundingCacheMocks.writeSessionGroundingOkCached.mockResolvedValue(undefined);
    authMocks.requireSessionUser.mockResolvedValue({
      userId: uid.toHexString(),
      tenantId: tid.toHexString(),
      roles: ["viewer"],
      email: "u@test.dev",
      tenantRole: "member",
      xUserId: "",
      username: "u"
    });
    identityMocks.getCoreUserById.mockResolvedValue({
      _id: uid,
      email: "u@test.dev",
      roles: ["viewer"],
      status: "active",
      createdAt: new Date(),
      updatedAt: new Date()
    });
    identityMocks.resolveTenantMembershipForSessionGrounding.mockResolvedValue({
      _id: new ObjectId(),
      userId: uid,
      tenantId: tid,
      role: "member",
      isDefaultTenant: true,
      createdAt: new Date(),
      updatedAt: new Date()
    });
  });

  it("returns 200 when membership matches session tenant", async () => {
    const res = await GET();
    expect(res.status).toBe(200);
    expect(((await res.json()) as { ok: boolean }).ok).toBe(true);
    expect(groundingCacheMocks.writeSessionGroundingOkCached).toHaveBeenCalled();
  });

  it("returns 200 from redis cache without Mongo reads", async () => {
    groundingCacheMocks.readSessionGroundingOkCached.mockResolvedValueOnce(true);
    const res = await GET();
    expect(res.status).toBe(200);
    expect(identityMocks.getCoreUserById).not.toHaveBeenCalled();
    expect(identityMocks.resolveTenantMembershipForSessionGrounding).not.toHaveBeenCalled();
  });

  it("returns 401 when membership row is missing", async () => {
    identityMocks.resolveTenantMembershipForSessionGrounding.mockResolvedValueOnce(null);
    const res = await GET();
    expect(res.status).toBe(401);
    expect(((await res.json()) as { code: string }).code).toBe("no_tenant_membership");
  });

  it("returns 401 when account is pending_approval", async () => {
    identityMocks.getCoreUserById.mockResolvedValueOnce({
      _id: uid,
      email: "u@test.dev",
      roles: ["viewer"],
      status: "active",
      accountStatus: "pending_approval",
      createdAt: new Date(),
      updatedAt: new Date()
    });
    const res = await GET();
    expect(res.status).toBe(401);
    expect(((await res.json()) as { code: string }).code).toBe("account_not_approved");
  });

  it("passes through unauthorized session responses", async () => {
    authMocks.requireSessionUser.mockResolvedValueOnce(
      NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    );
    const res = await GET();
    expect(res.status).toBe(401);
  });
});
