import { ObjectId } from "mongodb";
import { NextResponse } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const authMocks = vi.hoisted(() => ({
  requireAdminSession: vi.fn()
}));

const coreAdminMocks = vi.hoisted(() => ({
  getAccessRequestById: vi.fn(),
  updateAccessRequestPlanById: vi.fn(),
  updateAccessRequestTenantById: vi.fn(),
  updateAccessRequestRoleById: vi.fn(),
  reviewAccessRequestById: vi.fn(),
  deleteAccessRequest: vi.fn(),
  provisionDefaultPortfolioForUser: vi.fn()
}));

const identityMocks = vi.hoisted(() => ({
  addRoleToCoreUser: vi.fn(),
  assertCanAddUserToTenant: vi.fn().mockResolvedValue(undefined),
  updateCoreUserSubscriptionPlan: vi.fn(),
  getCoreUserById: vi.fn(),
  upsertTenantMembership: vi.fn()
}));

const auditMocks = vi.hoisted(() => ({
  createAuditEvent: vi.fn(),
  listAuditEventsForEntity: vi.fn()
}));

const bootstrapMocks = vi.hoisted(() => ({
  enqueueAccessRequestBootstrap: vi.fn()
}));

const emailCredentialMocks = vi.hoisted(() => ({
  issueCredentialInviteForUser: vi.fn().mockResolvedValue({ rawToken: "test-invite-token" })
}));

const sendCredentialEmailMocks = vi.hoisted(() => ({
  sendAccessApprovedPasswordInviteEmail: vi.fn().mockResolvedValue(true)
}));

vi.mock("@/lib/api-auth", () => authMocks);
vi.mock("@/modules/core-admin/repository", () => coreAdminMocks);
vi.mock("@/modules/identity/repository", () => identityMocks);
vi.mock("@/modules/audit/repository", () => auditMocks);
vi.mock("@/modules/core-admin/access-request-bootstrap", () => bootstrapMocks);
vi.mock("@/modules/identity/email-credentials-repository", () => emailCredentialMocks);
vi.mock("@/lib/send-email-credential-messages", () => sendCredentialEmailMocks);

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
    coreAdminMocks.updateAccessRequestTenantById.mockResolvedValue({
      _id: { toHexString: () => "507f1f77bcf86cd799439033" },
      userId: "507f1f77bcf86cd799439044",
      requestedRole: "viewer",
      requestedPlan: "basic",
      reason: "Need access",
      status: "pending",
      requestedAt: new Date("2026-03-16T00:00:00.000Z"),
      tenantId: { toHexString: () => "507f1f77bcf86cd7994390aa" }
    });
    coreAdminMocks.updateAccessRequestRoleById.mockResolvedValue({
      _id: { toHexString: () => "507f1f77bcf86cd799439033" },
      userId: "507f1f77bcf86cd799439044",
      requestedRole: "viewer",
      requestedPlan: "basic",
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
    auditMocks.createAuditEvent.mockResolvedValue(undefined);
    auditMocks.listAuditEventsForEntity.mockResolvedValue([]);
    bootstrapMocks.enqueueAccessRequestBootstrap.mockResolvedValue(undefined);
    identityMocks.upsertTenantMembership.mockResolvedValue(undefined);
  });

  it("gets access request by id", async () => {
    const response = await getAccessRequest(new Request("http://test"), {
      params: Promise.resolve({ requestId: "507f1f77bcf86cd799439033" })
    });
    expect(response.status).toBe(200);
  });

  it("assigns targetTenantId without status change", async () => {
    const afterTenant = {
      _id: { toHexString: () => "507f1f77bcf86cd799439033" },
      userId: "507f1f77bcf86cd799439044",
      requestedRole: "viewer",
      requestedPlan: "basic",
      reason: "Need access",
      status: "pending",
      requestedAt: new Date("2026-03-16T00:00:00.000Z"),
      tenantId: { toHexString: () => "507f1f77bcf86cd7994390aa" }
    };
    coreAdminMocks.getAccessRequestById
      .mockResolvedValueOnce({
        _id: { toHexString: () => "507f1f77bcf86cd799439033" },
        userId: "507f1f77bcf86cd799439044",
        requestedRole: "viewer",
        requestedPlan: "basic",
        reason: "Need access",
        status: "pending",
        requestedAt: new Date("2026-03-16T00:00:00.000Z")
      })
      .mockResolvedValue(afterTenant);

    const response = await putAccessRequest(
      new Request("http://test", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targetTenantId: "507f1f77bcf86cd7994390aa" })
      }),
      {
        params: Promise.resolve({ requestId: "507f1f77bcf86cd799439033" })
      }
    );
    expect(response.status).toBe(200);
    expect(coreAdminMocks.updateAccessRequestTenantById).toHaveBeenCalledWith({
      requestId: "507f1f77bcf86cd799439033",
      tenantIdHex: "507f1f77bcf86cd7994390aa",
      tenantId: undefined
    });
    expect(coreAdminMocks.reviewAccessRequestById).not.toHaveBeenCalled();
  });

  it("approves with tenant on row: upserts membership and skips resolve", async () => {
    const tenantOid = { toHexString: () => "507f1f77bcf86cd7994390aa" };
    coreAdminMocks.getAccessRequestById.mockResolvedValue({
      _id: { toHexString: () => "507f1f77bcf86cd799439033" },
      userId: "507f1f77bcf86cd799439044",
      tenantId: tenantOid,
      requestedRole: "operator",
      requestedPlan: "basic",
      reason: "Need access",
      status: "pending",
      requestedAt: new Date("2026-03-16T00:00:00.000Z")
    });
    coreAdminMocks.reviewAccessRequestById.mockResolvedValue({
      _id: { toHexString: () => "507f1f77bcf86cd799439033" },
      userId: "507f1f77bcf86cd799439044",
      tenantId: tenantOid,
      requestedRole: "operator",
      requestedPlan: "basic",
      reason: "Need access",
      status: "approved",
      reviewedBy: "507f1f77bcf86cd799439011",
      reviewedAt: new Date("2026-03-16T00:01:00.000Z"),
      requestedAt: new Date("2026-03-16T00:00:00.000Z")
    });

    const response = await putAccessRequest(
      new Request("http://test", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: "approved",
          requestedRole: "operator",
          requestedPlan: "basic",
          targetTenantId: "507f1f77bcf86cd7994390aa"
        })
      }),
      {
        params: Promise.resolve({ requestId: "507f1f77bcf86cd799439033" })
      }
    );
    expect(response.status).toBe(200);
    expect(identityMocks.upsertTenantMembership).toHaveBeenCalledWith({
      userId: expect.any(ObjectId),
      tenantId: tenantOid,
      role: "member",
      isDefaultTenant: true
    });
    expect(coreAdminMocks.provisionDefaultPortfolioForUser).toHaveBeenCalledWith({
      userId: "507f1f77bcf86cd799439044",
      tenantId: "507f1f77bcf86cd7994390aa"
    });
    expect(identityMocks.addRoleToCoreUser).toHaveBeenCalledWith(
      expect.objectContaining({ role: "operator" })
    );
  });

  it("updates plan and approval via PUT", async () => {
    const tenantOid = { toHexString: () => "507f1f77bcf86cd7994390aa" };
    coreAdminMocks.getAccessRequestById.mockResolvedValue({
      _id: { toHexString: () => "507f1f77bcf86cd799439033" },
      userId: "507f1f77bcf86cd799439044",
      tenantId: tenantOid,
      requestedRole: "viewer",
      requestedPlan: "basic",
      reason: "Need access",
      status: "pending",
      requestedAt: new Date("2026-03-16T00:00:00.000Z")
    });
    const response = await putAccessRequest(
      new Request("http://test", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          requestedPlan: "premium",
          requestedRole: "viewer",
          targetTenantId: "507f1f77bcf86cd7994390aa",
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
    expect(coreAdminMocks.provisionDefaultPortfolioForUser).toHaveBeenCalledWith({
      userId: "507f1f77bcf86cd799439044",
      tenantId: "507f1f77bcf86cd7994390aa"
    });
  });

  it("returns 400 when approving without targetTenantId in payload", async () => {
    const response = await putAccessRequest(
      new Request("http://test", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: "approved",
          requestedRole: "viewer",
          requestedPlan: "basic"
        })
      }),
      {
        params: Promise.resolve({ requestId: "507f1f77bcf86cd799439033" })
      }
    );
    expect(response.status).toBe(400);
    expect(coreAdminMocks.reviewAccessRequestById).not.toHaveBeenCalled();
  });

  it("approves with only status when the stored request already has tenant, role, and plan", async () => {
    const tenantOid = { toHexString: () => "507f1f77bcf86cd7994390aa" };
    coreAdminMocks.getAccessRequestById.mockResolvedValue({
      _id: { toHexString: () => "507f1f77bcf86cd799439033" },
      userId: "507f1f77bcf86cd799439044",
      tenantId: tenantOid,
      requestedRole: "viewer",
      requestedPlan: "basic",
      reason: "Need access",
      status: "pending",
      requestedAt: new Date("2026-03-16T00:00:00.000Z")
    });
    const response = await putAccessRequest(
      new Request("http://test", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "approved" })
      }),
      {
        params: Promise.resolve({ requestId: "507f1f77bcf86cd799439033" })
      }
    );
    expect(response.status).toBe(200);
    expect(coreAdminMocks.reviewAccessRequestById).toHaveBeenCalled();
    expect(identityMocks.addRoleToCoreUser).toHaveBeenCalledWith(
      expect.objectContaining({ role: "viewer" })
    );
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
