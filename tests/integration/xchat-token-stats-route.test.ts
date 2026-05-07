import { NextResponse } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const authMocks = vi.hoisted(() => ({
  requireApprovedAppUserSession: vi.fn()
}));

const repoMocks = vi.hoisted(() => ({
  getXchatTokenUsageStatsForUser: vi.fn()
}));

vi.mock("@/lib/api-auth", () => authMocks);
vi.mock("@/modules/xchat/repository", () => repoMocks);

import { GET } from "@/app/api/app-user/xchat/token-stats/route";

describe("/api/app-user/xchat/token-stats", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authMocks.requireApprovedAppUserSession.mockResolvedValue({
      userId: "507f1f77bcf86cd799439011",
      tenantId: "507f1f77bcf86cd799439022",
      roles: ["viewer"]
    });
    repoMocks.getXchatTokenUsageStatsForUser.mockResolvedValue({
      totalTokens: 1400,
      turnsWithUsage: 10,
      tokensLast60Minutes: 600,
      turnsWithUsageLast60Minutes: 3,
      tokensPerMinuteAvg60m: 10,
      windowMinutes: 60,
      computedAt: "2026-05-07T12:00:00.000Z"
    });
  });

  it("returns token stats for approved app user", async () => {
    const res = await GET();
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      data: { totalTokens: number; tokensPerMinuteAvg60m: number };
    };
    expect(body.data.totalTokens).toBe(1400);
    expect(body.data.tokensPerMinuteAvg60m).toBe(10);
    expect(repoMocks.getXchatTokenUsageStatsForUser).toHaveBeenCalledTimes(1);
    expect(res.headers.get("Cache-Control")).toContain("max-age=55");
  });

  it("returns 401 when session missing", async () => {
    authMocks.requireApprovedAppUserSession.mockResolvedValue(
      NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    );
    const res = await GET();
    expect(res.status).toBe(401);
    expect(repoMocks.getXchatTokenUsageStatsForUser).not.toHaveBeenCalled();
  });
});
