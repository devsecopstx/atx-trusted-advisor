import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { beforeEach, describe, expect, it, vi } from "vitest";

const authMocks = vi.hoisted(() => ({
  requireSessionUser: vi.fn()
}));

const repositoryMocks = vi.hoisted(() => ({
  createAccessRequest: vi.fn(),
  getPendingAccessRequestByUserAndRole: vi.fn()
}));

const auditMocks = vi.hoisted(() => ({
  createAuditEvent: vi.fn()
}));

const slackMocks = vi.hoisted(() => ({
  sendSlackNotification: vi.fn(),
  buildAccessRequestNotification: vi.fn()
}));

vi.mock("@/lib/auth", () => authMocks);
vi.mock("@/modules/core-admin/repository", () => repositoryMocks);
vi.mock("@/modules/audit/repository", () => auditMocks);
vi.mock("@/lib/slack", () => slackMocks);

import { POST } from "@/app/api/access-requests/route";

describe("POST /api/access-requests (self-service)", () => {
  const session = {
    userId: "user_abc",
    email: "viewer@atxfinance.ai",
    username: "viewer_test",
    roles: ["viewer"],
    tenantId: "tenant_xyz",
    tenantRole: "member"
  };

  beforeEach(() => {
    authMocks.requireSessionUser.mockResolvedValue(session);
    repositoryMocks.getPendingAccessRequestByUserAndRole.mockResolvedValue(null);
    repositoryMocks.createAccessRequest.mockResolvedValue({
      _id: new ObjectId(),
      requestedRole: "viewer",
      status: "pending",
      reason: "I need access",
      requestedAt: new Date()
    });
    auditMocks.createAuditEvent.mockResolvedValue(undefined);
    slackMocks.sendSlackNotification.mockResolvedValue(true);
    slackMocks.buildAccessRequestNotification.mockReturnValue({
      text: "New access request"
    });
  });

  it("creates access request and returns 201", async () => {
    const response = await POST(
      new Request("http://test/api/access-requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: "Need portfolio access for advisory work" })
      })
    );
    expect(response.status).toBe(201);
    const payload = (await response.json()) as { ok: boolean; data: { requestedRole: string; status: string } };
    expect(payload.ok).toBe(true);
    expect(payload.data.requestedRole).toBe("viewer");
    expect(payload.data.status).toBe("pending");
  });

  it("defaults requestedRole to viewer", async () => {
    await POST(
      new Request("http://test/api/access-requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: "Default role test" })
      })
    );
    expect(repositoryMocks.createAccessRequest).toHaveBeenCalledWith(
      expect.objectContaining({ requestedRole: "viewer" })
    );
  });

  it("accepts explicit requestedRole", async () => {
    repositoryMocks.createAccessRequest.mockResolvedValueOnce({
      _id: new ObjectId(),
      requestedRole: "advisor",
      status: "pending",
      reason: "Advisory access",
      requestedAt: new Date()
    });
    const response = await POST(
      new Request("http://test/api/access-requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ requestedRole: "advisor", reason: "Advisory access needed" })
      })
    );
    expect(response.status).toBe(201);
    expect(repositoryMocks.createAccessRequest).toHaveBeenCalledWith(
      expect.objectContaining({ requestedRole: "advisor" })
    );
  });

  it("returns 409 when pending request already exists", async () => {
    repositoryMocks.getPendingAccessRequestByUserAndRole.mockResolvedValueOnce({
      requestedRole: "viewer",
      status: "pending",
      requestedAt: new Date()
    });
    const response = await POST(
      new Request("http://test/api/access-requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: "Duplicate request" })
      })
    );
    expect(response.status).toBe(409);
    const payload = (await response.json()) as { error: string };
    expect(payload.error).toContain("pending access request");
  });

  it("returns 401 when unauthenticated", async () => {
    authMocks.requireSessionUser.mockResolvedValueOnce(
      NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    );
    const response = await POST(
      new Request("http://test/api/access-requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: "No session" })
      })
    );
    expect(response.status).toBe(401);
  });

  it("returns 400 for invalid JSON", async () => {
    const response = await POST(
      new Request("http://test/api/access-requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "not-json"
      })
    );
    expect(response.status).toBe(400);
  });

  it("returns 400 when reason is too short", async () => {
    const response = await POST(
      new Request("http://test/api/access-requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: "ab" })
      })
    );
    expect(response.status).toBe(400);
  });

  it("returns 400 for unsupported role", async () => {
    const response = await POST(
      new Request("http://test/api/access-requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ requestedRole: "global_admin", reason: "Elevate me" })
      })
    );
    expect(response.status).toBe(400);
  });

  it("creates audit event on success", async () => {
    await POST(
      new Request("http://test/api/access-requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: "Audit event test" })
      })
    );
    expect(auditMocks.createAuditEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        entityType: "access_request",
        action: "self_requested",
        actor: expect.objectContaining({ userId: "user_abc", email: "viewer@atxfinance.ai" })
      })
    );
  });

  it("sends Slack notification on success", async () => {
    await POST(
      new Request("http://test/api/access-requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: "Slack notify test" })
      })
    );
    expect(slackMocks.buildAccessRequestNotification).toHaveBeenCalledWith(
      expect.objectContaining({ email: "viewer@atxfinance.ai", requestedRole: "viewer" })
    );
  });
});
