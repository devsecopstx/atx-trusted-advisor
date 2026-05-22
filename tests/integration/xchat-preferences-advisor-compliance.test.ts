import { ObjectId } from "mongodb";
import { beforeEach, describe, expect, it, vi } from "vitest";

const authMocks = vi.hoisted(() => ({
  requireSessionUser: vi.fn()
}));

const complianceMocks = vi.hoisted(() => ({
  getAdvisorComplianceProfileForUser: vi.fn()
}));

const prefsMocks = vi.hoisted(() => ({
  getXchatUserPreferences: vi.fn(),
  upsertXchatUserPreferences: vi.fn()
}));

vi.mock("@/lib/auth", () => ({
  requireSessionUser: authMocks.requireSessionUser
}));

vi.mock("@/modules/compliance/repository", () => ({
  getAdvisorComplianceProfileForUser: complianceMocks.getAdvisorComplianceProfileForUser
}));

vi.mock("@/modules/xchat/user-preferences-repository", () => ({
  getXchatUserPreferences: prefsMocks.getXchatUserPreferences,
  upsertXchatUserPreferences: prefsMocks.upsertXchatUserPreferences
}));

vi.mock("@/modules/core-admin/access-request-bootstrap", () => ({
  resolveOrCreateUserBootstrapCollection: vi.fn()
}));

vi.mock("@/modules/xchat/repository", () => ({
  clearXchatLogsLongTermSyncSkippedForUser: vi.fn()
}));

vi.mock("@/modules/xchat/user-history-xai-purge", () => ({
  clearPerUserXaiHistoryCollectionForUserTenant: vi.fn()
}));

vi.mock("@/modules/audit/repository", () => ({
  createAuditEvent: vi.fn()
}));

import { PUT } from "@/app/api/xchat/preferences/route";

describe("PUT /api/xchat/preferences — advisor compliance chat history", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authMocks.requireSessionUser.mockResolvedValue({
      userId: "507f1f77bcf86cd799439011",
      tenantId: "507f1f77bcf86cd799439022",
      email: "advisor@test.local",
      roles: ["advisor"]
    });
    prefsMocks.getXchatUserPreferences.mockResolvedValue({
      keepLastTenMessages: true,
      enableLongTermXaiMemory: false
    });
    prefsMocks.upsertXchatUserPreferences.mockResolvedValue({
      keepLastTenMessages: true,
      enableLongTermXaiMemory: false,
      consentedAt: new Date(),
      xaiMemoryConsentedAt: null
    });
    complianceMocks.getAdvisorComplianceProfileForUser.mockResolvedValue({
      attestationAccepted: true,
      updatedAt: new Date()
    });
  });

  it("blocks disabling chat history when compliance attestation is accepted", async () => {
    const res = await PUT(
      new Request("http://test/api/xchat/preferences", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ keepLastTenMessages: false })
      })
    );
    expect(res.status).toBe(403);
    const body = (await res.json()) as { error: string };
    expect(body.error).toBe("advisor_compliance_chat_history_required");
    expect(prefsMocks.upsertXchatUserPreferences).not.toHaveBeenCalled();
  });

  it("allows disabling chat history for operators without attestation", async () => {
    authMocks.requireSessionUser.mockResolvedValue({
      userId: "507f1f77bcf86cd799439011",
      tenantId: "507f1f77bcf86cd799439022",
      email: "op@test.local",
      roles: ["operator"]
    });
    prefsMocks.upsertXchatUserPreferences.mockResolvedValue({
      keepLastTenMessages: false,
      enableLongTermXaiMemory: false,
      consentedAt: null,
      xaiMemoryConsentedAt: null
    });

    const res = await PUT(
      new Request("http://test/api/xchat/preferences", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ keepLastTenMessages: false })
      })
    );
    expect(res.status).toBe(200);
    expect(complianceMocks.getAdvisorComplianceProfileForUser).not.toHaveBeenCalled();
  });

  it("allows advisor to toggle long-term memory while retention stays on", async () => {
    const res = await PUT(
      new Request("http://test/api/xchat/preferences", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ keepLastTenMessages: true, enableLongTermXaiMemory: true })
      })
    );
    expect(res.status).toBe(200);
    expect(prefsMocks.upsertXchatUserPreferences).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: new ObjectId("507f1f77bcf86cd799439011"),
        keepLastTenMessages: true,
        enableLongTermXaiMemory: true
      })
    );
  });
});
