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

import { POST } from "@/app/api/access-requests/public/route";

describe("POST /api/access-requests/public rate limit", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    bffMocks.proxyRequestToBackend.mockResolvedValue(null);
    limitMocks.extractClientRateLimitKey.mockReturnValue("127.0.0.1");
  });

  it("returns 429 when limiter blocks guest request", async () => {
    limitMocks.checkDistributedRateLimit.mockResolvedValueOnce({
      allowed: false,
      remaining: 0,
      resetAtMs: Date.now() + 15_000,
      retryAfterSeconds: 15,
      source: "memory"
    });
    const response = await POST(
      new Request("http://test/api/access-requests/public", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "Guest User", email: "guest@example.com" })
      })
    );
    const payload = (await response.json()) as { error: string };
    expect(response.status).toBe(429);
    expect(payload.error).toBe("rate_limit_exceeded");
  });
});
