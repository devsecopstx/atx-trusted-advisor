import { beforeEach, describe, expect, it, vi } from "vitest";

const bffMocks = vi.hoisted(() => ({
  proxyRequestToBackend: vi.fn<(request: Request) => Promise<Response | null>>()
}));

const limitMocks = vi.hoisted(() => ({
  checkDistributedRateLimit: vi.fn(),
  extractClientRateLimitKey: vi.fn<(request: Request) => string>()
}));

vi.mock("@/lib/backend-bff", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/backend-bff")>();
  return {
    ...actual,
    proxyRequestToBackend: bffMocks.proxyRequestToBackend
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

import { POST as postStrategyJobTurn } from "@/app/api/strategy-jobs/[jobId]/turns/route";

describe("strategy-job turns route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    limitMocks.extractClientRateLimitKey.mockReturnValue("127.0.0.1");
    limitMocks.checkDistributedRateLimit.mockResolvedValue({
      allowed: true,
      remaining: 23,
      resetAtMs: Date.now() + 60_000,
      retryAfterSeconds: 60,
      source: "memory"
    });
    bffMocks.proxyRequestToBackend.mockResolvedValue(
      new Response(JSON.stringify({ data: { ok: true } }), {
        status: 200,
        headers: { "Content-Type": "application/json" }
      })
    );
  });

  it("POST proxies when limiter allows", async () => {
    const req = new Request("http://test/api/strategy-jobs/job_123/turns", { method: "POST" });
    const res = await postStrategyJobTurn(req, {
      params: Promise.resolve({ jobId: "job_123" })
    });
    expect(res.status).toBe(200);
    expect(limitMocks.checkDistributedRateLimit).toHaveBeenCalled();
    expect(bffMocks.proxyRequestToBackend).toHaveBeenCalledWith(req);
  });

  it("POST returns 429 when limiter blocks", async () => {
    limitMocks.checkDistributedRateLimit.mockResolvedValueOnce({
      allowed: false,
      remaining: 0,
      resetAtMs: Date.now() + 10_000,
      retryAfterSeconds: 10,
      source: "memory"
    });
    const req = new Request("http://test/api/strategy-jobs/job_123/turns", { method: "POST" });
    const res = await postStrategyJobTurn(req, {
      params: Promise.resolve({ jobId: "job_123" })
    });
    expect(res.status).toBe(429);
    expect(bffMocks.proxyRequestToBackend).not.toHaveBeenCalled();
  });
});
