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

import { GET as getStrategyJobArtifact } from "@/app/api/strategy-jobs/[jobId]/artifact/route";
import { GET as getStrategyJobById } from "@/app/api/strategy-jobs/[jobId]/route";

describe("strategy-job read routes rate limits", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    limitMocks.extractClientRateLimitKey.mockReturnValue("127.0.0.1");
    limitMocks.checkDistributedRateLimit.mockResolvedValue({
      allowed: true,
      remaining: 19,
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

  it("GET /api/strategy-jobs/{jobId} proxies when limiter allows", async () => {
    const req = new Request("http://test/api/strategy-jobs/job_123");
    const res = await getStrategyJobById(req, {
      params: Promise.resolve({ jobId: "job_123" })
    });
    expect(res.status).toBe(200);
    expect(limitMocks.checkDistributedRateLimit).toHaveBeenCalled();
    expect(bffMocks.proxyRequestToBackend).toHaveBeenCalledWith(req);
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
    expect(bffMocks.proxyRequestToBackend).not.toHaveBeenCalled();
  });
});
