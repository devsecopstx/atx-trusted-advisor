import { NextResponse } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const authMocks = vi.hoisted(() => ({
  requireSessionUser: vi.fn()
}));

const bffMocks = vi.hoisted(() => ({
  proxyPortfolioRequestToBackend: vi.fn<(request: Request) => Promise<Response | null>>()
}));

vi.mock("@/lib/auth", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/auth")>();
  return {
    ...actual,
    requireSessionUser: authMocks.requireSessionUser
  };
});

vi.mock("@/lib/backend-bff", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/backend-bff")>();
  return {
    ...actual,
    proxyPortfolioRequestToBackend: bffMocks.proxyPortfolioRequestToBackend
  };
});

import { POST as postStrategyRecommendationsGenerate } from "@/app/api/strategy-recommendations/generate/route";

describe("strategy-recommendations generate API BFF proxy", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    bffMocks.proxyPortfolioRequestToBackend.mockResolvedValue(null);
    authMocks.requireSessionUser.mockResolvedValue({
      userId: "507f1f77bcf86cd799439011",
      tenantId: "507f1f77bcf86cd799439022",
      email: "advisor@test.local",
      username: "adv1",
      roles: ["advisor"]
    });
  });

  it("POST returns 401 when session is missing", async () => {
    authMocks.requireSessionUser.mockResolvedValueOnce(
      NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    );
    const req = new Request("http://test/api/strategy-recommendations/generate", { method: "POST" });
    const res = await postStrategyRecommendationsGenerate(req);
    expect(res.status).toBe(401);
    expect(bffMocks.proxyPortfolioRequestToBackend).not.toHaveBeenCalled();
  });

  it("POST returns 403 when roles cannot use product", async () => {
    authMocks.requireSessionUser.mockResolvedValueOnce({
      userId: "507f1f77bcf86cd799439011",
      tenantId: "507f1f77bcf86cd799439022",
      email: "guest@test.local",
      username: "g1",
      roles: []
    });
    const req = new Request("http://test/api/strategy-recommendations/generate", { method: "POST" });
    const res = await postStrategyRecommendationsGenerate(req);
    expect(res.status).toBe(403);
    expect(bffMocks.proxyPortfolioRequestToBackend).not.toHaveBeenCalled();
  });

  it("POST proxies to backend when proxy resolves non-null", async () => {
    const proxied = new Response(JSON.stringify({ data: { ok: true } }), {
      status: 200,
      headers: { "Content-Type": "application/json" }
    });
    bffMocks.proxyPortfolioRequestToBackend.mockResolvedValueOnce(proxied);
    const req = new Request("http://test/api/strategy-recommendations/generate", { method: "POST" });
    const res = await postStrategyRecommendationsGenerate(req);
    expect(res.status).toBe(200);
    expect(bffMocks.proxyPortfolioRequestToBackend).toHaveBeenCalledTimes(1);
    expect(bffMocks.proxyPortfolioRequestToBackend.mock.calls[0]?.[0]).toBe(req);
    const body = (await res.json()) as { data: { ok: boolean } };
    expect(body.data.ok).toBe(true);
  });

  it("POST returns 503 when BFF is off (proxy null)", async () => {
    const req = new Request("http://test/api/strategy-recommendations/generate", { method: "POST" });
    const res = await postStrategyRecommendationsGenerate(req);
    expect(res.status).toBe(503);
    expect(bffMocks.proxyPortfolioRequestToBackend).toHaveBeenCalledWith(req);
    const payload = (await res.json()) as { error: string };
    expect(payload.error).toBe("service_unavailable");
  });
});
