import { beforeEach, describe, expect, it, vi } from "vitest";

const authMocks = vi.hoisted(() => ({
  requireSessionUser: vi.fn()
}));

const bffMocks = vi.hoisted(() => ({
  proxyPortfolioRequestToBackend: vi.fn<(request: Request) => Promise<Response | null>>()
}));

const limitMocks = vi.hoisted(() => ({
  checkDistributedRateLimit: vi.fn(),
  extractClientRateLimitKey: vi.fn<(request: Request) => string>()
}));

const entitlementsMocks = vi.hoisted(() => ({
  resolveXoptionsEntitlements: vi.fn()
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

vi.mock("@/lib/distributed-rate-limit", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/distributed-rate-limit")>();
  return {
    ...actual,
    checkDistributedRateLimit: limitMocks.checkDistributedRateLimit,
    extractClientRateLimitKey: limitMocks.extractClientRateLimitKey
  };
});

vi.mock("@/modules/xoptions/entitlements", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/modules/xoptions/entitlements")>();
  return {
    ...actual,
    resolveXoptionsEntitlements: entitlementsMocks.resolveXoptionsEntitlements
  };
});

import { GET as getStrategyJobArtifact } from "@/app/api/strategy-jobs/[jobId]/artifact/route";
import { GET as getStrategyJobById } from "@/app/api/strategy-jobs/[jobId]/route";

describe("strategy-job read routes rate limits", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    limitMocks.extractClientRateLimitKey.mockReturnValue("127.0.0.1");
    authMocks.requireSessionUser.mockResolvedValue({
      userId: "507f1f77bcf86cd799439011",
      tenantId: "507f1f77bcf86cd799439022",
      email: "premium-plus@test.local",
      username: "pp1",
      roles: ["operator"]
    });
    entitlementsMocks.resolveXoptionsEntitlements.mockResolvedValue({
      subscriptionPlan: "premium_plus",
      fullChainAnalytics: true,
      hardcoreStrategyJobs: true
    });
    limitMocks.checkDistributedRateLimit.mockResolvedValue({
      allowed: true,
      remaining: 19,
      resetAtMs: Date.now() + 60_000,
      retryAfterSeconds: 60,
      source: "memory"
    });
    bffMocks.proxyPortfolioRequestToBackend.mockResolvedValue(
      new Response(JSON.stringify({ data: { ok: true } }), {
        status: 200,
        headers: { "Content-Type": "application/json" }
      })
    );
  });

  it("GET /api/strategy-jobs/{jobId} proxies when limiter allows", async () => {
    const req = new Request("http://test/api/strategy-jobs/job_123");
    const res = await getStrategyJobById(req, {
      params: Promise.resolve({ jobId: "job_123" })
    });
    expect(res.status).toBe(200);
    expect(limitMocks.checkDistributedRateLimit).toHaveBeenCalled();
    expect(bffMocks.proxyPortfolioRequestToBackend).toHaveBeenCalledWith(req);
  });

  it("GET /api/strategy-jobs/{jobId}/artifact returns 429 when limiter blocks", async () => {
    limitMocks.checkDistributedRateLimit.mockResolvedValueOnce({
      allowed: false,
      remaining: 0,
      resetAtMs: Date.now() + 10_000,
      retryAfterSeconds: 10,
      source: "memory"
    });
    const req = new Request("http://test/api/strategy-jobs/job_123/artifact");
    const res = await getStrategyJobArtifact(req, {
      params: Promise.resolve({ jobId: "job_123" })
    });
    expect(res.status).toBe(429);
    expect(bffMocks.proxyPortfolioRequestToBackend).not.toHaveBeenCalled();
  });

  it("GET returns 403 when user is not Premium+", async () => {
    entitlementsMocks.resolveXoptionsEntitlements.mockResolvedValueOnce({
      subscriptionPlan: "premium",
      fullChainAnalytics: true,
      hardcoreStrategyJobs: false
    });
    const req = new Request("http://test/api/strategy-jobs/job_123");
    const res = await getStrategyJobById(req, {
      params: Promise.resolve({ jobId: "job_123" })
    });
    const payload = (await res.json()) as { error: string };
    expect(res.status).toBe(403);
    expect(payload.error).toBe("plan_upgrade_required");
    expect(limitMocks.checkDistributedRateLimit).not.toHaveBeenCalled();
    expect(bffMocks.proxyPortfolioRequestToBackend).not.toHaveBeenCalled();
  });
});
