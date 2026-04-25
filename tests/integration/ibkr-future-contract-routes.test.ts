import { NextResponse } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const authMocks = vi.hoisted(() => ({
  requireApprovedAppUserSession: vi.fn()
}));

const configMocks = vi.hoisted(() => ({
  parseIbkrIntegrationConfig: vi.fn()
}));

vi.mock("@/lib/api-auth", () => authMocks);
vi.mock("@/modules/ibkr-integration/config", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/modules/ibkr-integration/config")>();
  return {
    ...actual,
    parseIbkrIntegrationConfig: configMocks.parseIbkrIntegrationConfig
  };
});

import { GET as getAutomationRules } from "@/app/api/integrations/ibkr/accounts/[accountId]/automation-rules/route";
import { POST as postOrderPreview } from "@/app/api/integrations/ibkr/accounts/[accountId]/orders/preview/route";

describe("IBKR future-contract routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authMocks.requireApprovedAppUserSession.mockResolvedValue({
      userId: "507f1f77bcf86cd799439011",
      tenantId: "507f1f77bcf86cd799439022",
      roles: ["viewer"]
    });
    configMocks.parseIbkrIntegrationConfig.mockReturnValue({
      enabled: true
    });
  });

  it("returns not_implemented for order preview contract", async () => {
    const res = await postOrderPreview();
    expect(res.status).toBe(501);
    const body = (await res.json()) as { error: string };
    expect(body.error).toBe("not_implemented");
  });

  it("returns not_implemented for automation-rules contract", async () => {
    const res = await getAutomationRules();
    expect(res.status).toBe(501);
    const body = (await res.json()) as { error: string };
    expect(body.error).toBe("not_implemented");
  });

  it("passes through unauthorized", async () => {
    authMocks.requireApprovedAppUserSession.mockResolvedValueOnce(
      NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    );
    const res = await getAutomationRules();
    expect(res.status).toBe(401);
  });
});
