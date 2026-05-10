import { NextResponse } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const authMocks = vi.hoisted(() => ({
  requireApprovedAppUserSession: vi.fn()
}));

const workspaceMocks = vi.hoisted(() => ({
  getEffectiveWorkspaceLimitsForUser: vi.fn()
}));

const peekMocks = vi.hoisted(() => ({
  peekXchatAskUsageCounts: vi.fn()
}));

const coreUserMocks = vi.hoisted(() => ({
  getCoreUserById: vi.fn()
}));

vi.mock("@/lib/api-auth", () => authMocks);
vi.mock("@/lib/tenant-workspace-limits", () => workspaceMocks);
vi.mock("@/modules/xchat/ask-usage-limits", () => peekMocks);
vi.mock("@/modules/identity/repository", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/modules/identity/repository")>();
  return {
    ...actual,
    getCoreUserById: coreUserMocks.getCoreUserById
  };
});

import { GET } from "@/app/api/app-user/xchat/prompt-usage/route";

describe("GET /api/app-user/xchat/prompt-usage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authMocks.requireApprovedAppUserSession.mockResolvedValue({
      userId: "507f1f77bcf86cd799439011",
      tenantId: "507f1f77bcf86cd799439022",
      roles: ["viewer"]
    });
    workspaceMocks.getEffectiveWorkspaceLimitsForUser.mockResolvedValue({
      userChatLimit: 100,
      userChatHourlyLimit: 20,
      userXoptionsLimit: 10,
      tenantPortfolioLimit: 2,
      portfolioAccountLimit: 3,
      changePersonaEnabled: true,
      chatHistoryMax: 10,
      maxUsersPerTenant: 5,
      userTasksMax: 5
    });
    coreUserMocks.getCoreUserById.mockResolvedValue({
      subscriptionPlan: "premium"
    });
    peekMocks.peekXchatAskUsageCounts.mockResolvedValue({
      minuteCount: 1,
      hourCount: 4,
      dayCount: 12
    });
  });

  it("returns merged caps + UTC reset hints for approved app user (happy path)", async () => {
    const res = await GET();
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      data: {
        usedToday: number;
        dailyCap: number;
        hourlyCap: number;
        workspaceCapsEnforced: boolean;
      };
    };
    expect(body.data.usedToday).toBe(12);
    expect(body.data.dailyCap).toBe(100);
    expect(body.data.hourlyCap).toBe(20);
    expect(body.data.workspaceCapsEnforced).toBe(true);
    expect(peekMocks.peekXchatAskUsageCounts).toHaveBeenCalled();
    expect(res.headers.get("Cache-Control")).toContain("max-age=25");
  });

  it("marks limitsFallback when workspace resolution throws", async () => {
    workspaceMocks.getEffectiveWorkspaceLimitsForUser.mockRejectedValueOnce(new Error("mongo blip"));
    const res = await GET();
    expect(res.status).toBe(200);
    const body = (await res.json()) as { data: { limitsFallback?: string; dailyCap: number } };
    expect(body.data.limitsFallback).toBe("plan_defaults");
    expect(body.data.dailyCap).toBe(5);
  });

  it("returns 401 when session missing", async () => {
    authMocks.requireApprovedAppUserSession.mockResolvedValue(
      NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    );
    const res = await GET();
    expect(res.status).toBe(401);
    expect(peekMocks.peekXchatAskUsageCounts).not.toHaveBeenCalled();
  });
});
