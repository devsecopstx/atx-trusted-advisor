import { NextResponse } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const authMocks = vi.hoisted(() => ({
  requireAdminSession: vi.fn()
}));

const identityMocks = vi.hoisted(() => ({
  lookupCoreUserBackoffice: vi.fn(),
  patchCoreUserBackoffice: vi.fn()
}));

const auditMocks = vi.hoisted(() => ({
  createAuditEvent: vi.fn()
}));

vi.mock("@/lib/api-auth", () => authMocks);
vi.mock("@/modules/identity/repository", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/modules/identity/repository")>();
  return { ...actual, ...identityMocks };
});
vi.mock("@/modules/audit/repository", () => auditMocks);

import { POST } from "@/app/api/admin/backoffice/core-users/route";

describe("POST /api/admin/backoffice/core-users", () => {
  beforeEach(() => {
    authMocks.requireAdminSession.mockResolvedValue({
      userId: "507f1f77bcf86cd799439011",
      tenantId: "507f1f77bcf86cd799439022",
      email: "admin@atxfinance.ai",
      username: "xf-admin",
      roles: ["global_admin"]
    });
    auditMocks.createAuditEvent.mockResolvedValue(undefined);
  });

  it("lookup returns 200 and audits", async () => {
    identityMocks.lookupCoreUserBackoffice.mockResolvedValueOnce({
      _id: { toHexString: () => "507f1f77bcf86cd799439033" },
      email: "u@example.com",
      roles: ["viewer"],
      subscriptionPlan: "basic",
      status: "active",
      createdAt: new Date("2026-01-01T00:00:00.000Z"),
      updatedAt: new Date("2026-01-02T00:00:00.000Z")
    });

    const res = await POST(
      new Request("http://test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ op: "lookup", by: "email", value: "u@example.com" })
      })
    );
    const body = (await res.json()) as { found: boolean; data: { email: string } };

    expect(res.status).toBe(200);
    expect(body.found).toBe(true);
    expect(body.data.email).toBe("u@example.com");
    expect(auditMocks.createAuditEvent).toHaveBeenCalledWith(
      expect.objectContaining({ action: "backoffice_user_lookup" })
    );
  });

  it("patch returns 200 and audits", async () => {
    identityMocks.patchCoreUserBackoffice.mockResolvedValueOnce({
      ok: true,
      user: {
        _id: { toHexString: () => "507f1f77bcf86cd799439033" },
        email: "u@example.com",
        roles: ["viewer"],
        subscriptionPlan: "premium",
        status: "active",
        createdAt: new Date("2026-01-01T00:00:00.000Z"),
        updatedAt: new Date("2026-01-03T00:00:00.000Z")
      }
    });

    const res = await POST(
      new Request("http://test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          op: "patch",
          userId: "507f1f77bcf86cd799439033",
          subscriptionPlan: "premium"
        })
      })
    );
    const body = (await res.json()) as { data: { subscriptionPlan: string } };

    expect(res.status).toBe(200);
    expect(body.data.subscriptionPlan).toBe("premium");
    expect(auditMocks.createAuditEvent).toHaveBeenCalledWith(
      expect.objectContaining({ action: "backoffice_user_patch" })
    );
  });

  it("returns 400 when patch has no fields", async () => {
    const res = await POST(
      new Request("http://test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          op: "patch",
          userId: "507f1f77bcf86cd799439033"
        })
      })
    );
    expect(res.status).toBe(400);
  });

  it("returns 403 when not admin", async () => {
    authMocks.requireAdminSession.mockResolvedValueOnce(
      NextResponse.json({ error: "Forbidden" }, { status: 403 })
    );
    const res = await POST(
      new Request("http://test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ op: "lookup", by: "id", value: "507f1f77bcf86cd799439033" })
      })
    );
    expect(res.status).toBe(403);
  });
});
