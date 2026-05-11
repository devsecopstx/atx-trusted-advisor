import { NextResponse } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

beforeEach(() => {
  process.env.XAI_API_KEY = process.env.XAI_API_KEY ?? "test";
  process.env.XAI_MANAGEMENT_API_KEY = process.env.XAI_MANAGEMENT_API_KEY ?? "test";
  process.env.X_OAUTH_CLIENT_ID = process.env.X_OAUTH_CLIENT_ID ?? "cid";
  process.env.X_OAUTH_CLIENT_SECRET = process.env.X_OAUTH_CLIENT_SECRET ?? "sec";
  process.env.AUTH_SECRET = process.env.AUTH_SECRET ?? "01234567890123456789012345678901";
});

const authMocks = vi.hoisted(() => ({
  requireGlobalAdminSession: vi.fn()
}));

const tenantMocks = vi.hoisted(() => ({
  getTenantByHexIdCached: vi.fn()
}));

const workspaceMocks = vi.hoisted(() => ({
  effectiveWorkspaceLimitsForTenantAndPlan: vi.fn()
}));

const userMocks = vi.hoisted(() => ({
  getCoreUserById: vi.fn()
}));

const peekMocks = vi.hoisted(() => ({
  peekXchatAskUsageCounts: vi.fn()
}));

vi.mock("@/lib/api-auth", () => authMocks);

vi.mock("@/lib/server-request-cache", () => ({
  getTenantByHexIdCached: tenantMocks.getTenantByHexIdCached
}));

vi.mock("@/lib/tenant-workspace-limits", () => workspaceMocks);

vi.mock("@/modules/identity/repository", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/modules/identity/repository")>();
  return {
    ...actual,
    getCoreUserById: userMocks.getCoreUserById
  };
});

vi.mock("@/modules/xchat/ask-usage-limits", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/modules/xchat/ask-usage-limits")>();
  return {
    ...actual,
    peekXchatAskUsageCounts: peekMocks.peekXchatAskUsageCounts
  };
});

vi.mock("@/modules/xchat/xchat-limit-observability", () => ({
  getXchatLimitMetricsSnapshot: vi.fn(() => ({
    asksTotalByKey: { "allowed|t|basic": 2 },
    exceededTotalByType: {},
    limitCheckDurationMs: { sum: 10, count: 2, max: 8, avgMs: 5 },
    limiterCircuitThreshold: 3,
    limiterConsecutiveFailures: 0
  }))
}));

import { GET } from "@/app/api/admin/xchat/usage/route";

describe("GET /api/admin/xchat/usage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authMocks.requireGlobalAdminSession.mockResolvedValue({
      userId: "507f1f77bcf86cd799439011",
      tenantId: "507f1f77bcf86cd799439022",
      email: "admin@example.com",
      roles: ["global_admin"],
      tenantRole: "tenant_admin",
      xUserId: "1",
      username: "admin"
    });
    tenantMocks.getTenantByHexIdCached.mockResolvedValue({ name: "Core" });
    userMocks.getCoreUserById.mockResolvedValue({ subscriptionPlan: "premium" });
    workspaceMocks.effectiveWorkspaceLimitsForTenantAndPlan.mockResolvedValue({
      userChatLimit: 80,
      userChatHourlyLimit: 12,
      userXoptionsLimit: 10,
      tenantPortfolioLimit: 2,
      portfolioAccountLimit: 3,
      changePersonaEnabled: true,
      chatHistoryMax: 10,
      maxUsersPerTenant: 5,
      userTasksMax: 5,
      outlookRefreshEnabled: true
    });
    peekMocks.peekXchatAskUsageCounts.mockResolvedValue({
      minuteCount: 1,
      hourCount: 2,
      dayCount: 7
    });
  });

  it("returns 400 without valid userId", async () => {
    const res = await GET(
      new Request("http://localhost/api/admin/xchat/usage?tenantId=507f1f77bcf86cd799439022")
    );
    expect(res.status).toBe(400);
  });

  it("returns counts + merged caps for global_admin", async () => {
    const uid = "507f1f77bcf86cd799439033";
    const tid = "507f1f77bcf86cd799439022";
    const res = await GET(
      new Request(`http://localhost/api/admin/xchat/usage?userId=${uid}&tenantId=${tid}`)
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      data: {
        userId: string;
        tenantId: string;
        counts: { dayCount: number };
        mergedPromptCaps: { dailyCap: number };
      };
    };
    expect(body.data.userId).toBe(uid);
    expect(body.data.tenantId).toBe(tid);
    expect(body.data.counts.dayCount).toBe(7);
    expect(body.data.mergedPromptCaps.dailyCap).toBe(80);
    expect(peekMocks.peekXchatAskUsageCounts).toHaveBeenCalledWith(
      expect.objectContaining({ userId: uid, tenantId: tid })
    );
  });

  it("returns 403 when session is not global_admin", async () => {
    authMocks.requireGlobalAdminSession.mockResolvedValueOnce(
      NextResponse.json({ error: "Forbidden" }, { status: 403 })
    );
    const res = await GET(
      new Request(
        "http://localhost/api/admin/xchat/usage?userId=507f1f77bcf86cd799439033&tenantId=507f1f77bcf86cd799439022"
      )
    );
    expect(res.status).toBe(403);
  });
});
