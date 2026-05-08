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

vi.mock("@/lib/auth", () => authMocks);
vi.mock("@/modules/identity/repository", () => identityMocks);

import { GET } from "@/app/api/internal/authz/session-grounding/route";

describe("internal session grounding route", () => {
  const uid = new ObjectId();
  const tid = new ObjectId();

  beforeEach(() => {
    vi.clearAllMocks();
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
