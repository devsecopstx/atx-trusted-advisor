import { beforeEach, describe, expect, it, vi } from "vitest";

const authMocks = vi.hoisted(() => ({
  requireApprovedAppUserSession: vi.fn()
}));

const reportMocks = vi.hoisted(() => ({
  buildAdvisorComplianceReportExport: vi.fn()
}));

vi.mock("@/lib/api-auth", () => ({
  requireApprovedAppUserSession: authMocks.requireApprovedAppUserSession
}));

vi.mock("@/lib/server-request-cache", () => ({
  getTenantByHexIdCached: vi.fn().mockResolvedValue({ name: "Acme IA LLC", slug: "acme-ia" })
}));

vi.mock("@/modules/compliance/compliance-report-export", () => reportMocks);

import { GET } from "@/app/api/app-user/compliance/report/export/route";

describe("GET /api/app-user/compliance/report/export", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authMocks.requireApprovedAppUserSession.mockResolvedValue({
      userId: "507f1f77bcf86cd799439011",
      tenantId: "507f1f77bcf86cd799439022",
      email: "advisor@test.local",
      roles: ["advisor"]
    });
    reportMocks.buildAdvisorComplianceReportExport.mockResolvedValue({
      exportedAt: "2026-05-21T12:00:00.000Z",
      reportVersion: "2026-05-advisor-compliance-v1",
      user: { userId: "507f1f77bcf86cd799439011", email: "advisor@test.local", roles: ["advisor"] },
      tenant: { tenantId: "507f1f77bcf86cd799439022", firmName: "Acme IA LLC", slug: "acme-ia" },
      compliance: {
        enforced: true,
        complete: true,
        missingSteps: [],
        disclosureVersion: "2026-05-advisor-v1",
        chatHistoryRetentionRequired: true,
        profile: { attestationAccepted: true }
      },
      finraRegistrations: [],
      disclosure: { version: "2026-05-advisor-v1", short: "short", attestationText: "attest" }
    });
  });

  it("returns JSON attachment for advisors", async () => {
    const res = await GET();
    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Disposition")).toContain("attachment");
    const body = (await res.json()) as { reportVersion: string };
    expect(body.reportVersion).toBe("2026-05-advisor-compliance-v1");
  });

  it("returns 403 when report builder denies non-advisor", async () => {
    reportMocks.buildAdvisorComplianceReportExport.mockResolvedValueOnce({ error: "forbidden" });
    const res = await GET();
    expect(res.status).toBe(403);
  });
});
