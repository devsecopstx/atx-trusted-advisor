import { NextResponse } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const authMocks = vi.hoisted(() => ({
  requireAdminSession: vi.fn()
}));

const coreAdminMocks = vi.hoisted(() => ({
  getAccessRequestById: vi.fn(),
  updateAccessRequestPlanById: vi.fn(),
  reviewAccessRequestById: vi.fn(),
  deleteAccessRequest: vi.fn(),
  provisionDefaultPortfolioForUser: vi.fn()
}));

const identityMocks = vi.hoisted(() => ({
  addRoleToCoreUser: vi.fn(),
  updateCoreUserSubscriptionPlan: vi.fn(),
  getCoreUserById: vi.fn(),
  resolveTenantIdForApprovedUserPortfolio: vi.fn()
}));

const auditMocks = vi.hoisted(() => ({
  createAuditEvent: vi.fn(),
  listAuditEventsForEntity: vi.fn()
}));

const bootstrapMocks = vi.hoisted(() => ({
  enqueueAccessRequestBootstrap: vi.fn()
}));

vi.mock("@/lib/api-auth", () => authMocks);
vi.mock("@/modules/core-admin/repository", () => coreAdminMocks);
vi.mock("@/modules/identity/repository", () => identityMocks);
vi.mock("@/modules/audit/repository", () => auditMocks);
vi.mock("@/modules/core-admin/access-request-bootstrap", () => bootstrapMocks);

import {
    DELETE as deleteAccessRequest,
    GET as getAccessRequest,
    PUT as putAccessRequest
} from "@/app/api/admin/access-requests/[requestId]/route";

describe("access request item CRUD route", () => {
  beforeEach(() => {
    authMocks.requireAdminSession.mockResolvedValue({
      userId: "507f1f77bcf86cd799439011",
      tenantId: "507f1f77bcf86cd799439022",
      roles: ["global_admin"]
    });
    coreAdminMocks.getAccessRequestById.mockResolvedValue({
      _id: { toHexString: () => "507f1f77bcf86cd799439033" },
      userId: "507f1f77bcf86cd799439044",
      requestedRole: "viewer",
      requestedPlan: "basic",
      reason: "Need access",
      status: "pending",
      requestedAt: new Date("2026-03-16T00:00:00.000Z")
    });
    coreAdminMocks.updateAccessRequestPlanById.mockResolvedValue({
      _id: { toHexString: () => "507f1f77bcf86cd799439033" },
      userId: "507f1f77bcf86cd799439044",
      requestedRole: "viewer",
      requestedPlan: "premium",
      reason: "Need access",
      status: "pending",
      requestedAt: new Date("2026-03-16T00:00:00.000Z")
    });
    coreAdminMocks.reviewAccessRequestById.mockResolvedValue({
      _id: { toHexString: () => "507f1f77bcf86cd799439033" },
      userId: "507f1f77bcf86cd799439044",
      requestedRole: "viewer",
      requestedPlan: "premium",
      reason: "Need access",
      status: "approved",
      reviewedBy: "507f1f77bcf86cd799439011",
      reviewedAt: new Date("2026-03-16T00:01:00.000Z"),
      requestedAt: new Date("2026-03-16T00:00:00.000Z")
    });
    coreAdminMocks.deleteAccessRequest.mockResolvedValue(true);
    coreAdminMocks.provisionDefaultPortfolioForUser.mockResolvedValue({
      portfolio: {},
      account: {},
      watchlist: {}
    });
    identityMocks.addRoleToCoreUser.mockResolvedValue({});
    identityMocks.updateCoreUserSubscriptionPlan.mockResolvedValue({});
    identityMocks.getCoreUserById.mockResolvedValue({
      email: "viewer@atxfinance.ai"
    });
    identityMocks.resolveTenantIdForApprovedUserPortfolio.mockResolvedValue("507f1f77bcf86cd799439055");
    auditMocks.createAuditEvent.mockResolvedValue(undefined);
    auditMocks.listAuditEventsForEntity.mockResolvedValue([]);
    bootstrapMocks.enqueueAccessRequestBootstrap.mockResolvedValue(undefined);
  });

  it("gets access request by id", async () => {
    const response = await getAccessRequest(new Request("http://test"), {
      params: Promise.resolve({ requestId: "507f1f77bcf86cd799439033" })
    });
    expect(response.status).toBe(200);
  });

  it("updates plan and approval via PUT", async () => {
    const response = await putAccessRequest(
      new Request("http://test", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          requestedPlan: "premium",
          status: "approved"
        })
      }),
      {
        params: Promise.resolve({ requestId: "507f1f77bcf86cd799439033" })
      }
    );
    expect(response.status).toBe(200);
    expect(coreAdminMocks.updateAccessRequestPlanById).toHaveBeenCalledTimes(1);
    expect(coreAdminMocks.reviewAccessRequestById).toHaveBeenCalledTimes(1);
    expect(identityMocks.addRoleToCoreUser).toHaveBeenCalledWith(
      expect.objectContaining({ role: "viewer" })
    );
    expect(identityMocks.resolveTenantIdForApprovedUserPortfolio).toHaveBeenCalledWith(
      "507f1f77bcf86cd799439044"
    );
    expect(coreAdminMocks.provisionDefaultPortfolioForUser).toHaveBeenCalledWith({
      userId: "507f1f77bcf86cd799439044",
      tenantId: "507f1f77bcf86cd799439055"
    });
  });

  it("deletes access request by id", async () => {
    const response = await deleteAccessRequest(new Request("http://test"), {
      params: Promise.resolve({ requestId: "507f1f77bcf86cd799439033" })
    });
    expect(response.status).toBe(200);
    expect(coreAdminMocks.deleteAccessRequest).toHaveBeenCalledTimes(1);
  });

  it("returns auth response for non-admin", async () => {
    authMocks.requireAdminSession.mockResolvedValueOnce(
      NextResponse.json({ error: "Forbidden" }, { status: 403 })
    );
    const response = await getAccessRequest(new Request("http://test"), {
      params: Promise.resolve({ requestId: "507f1f77bcf86cd799439033" })
    });
    expect(response.status).toBe(403);
  });
});
