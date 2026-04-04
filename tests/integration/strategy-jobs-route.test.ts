import { NextResponse } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const authMocks = vi.hoisted(() => ({
  requireSessionUser: vi.fn()
}));

const bffMocks = vi.hoisted(() => ({
  proxyRequestToBackend: vi.fn<(request: Request) => Promise<Response | null>>()
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
    proxyRequestToBackend: bffMocks.proxyRequestToBackend
  };
});

import { GET as getStrategyJobs, POST as postStrategyJobs } from "@/app/api/strategy-jobs/route";

describe("strategy-jobs route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    bffMocks.proxyRequestToBackend.mockResolvedValue(
      new Response(JSON.stringify({ data: { jobs: [] } }), {
        status: 200,
        headers: { "Content-Type": "application/json" }
      })
    );
    authMocks.requireSessionUser.mockResolvedValue({
      userId: "507f1f77bcf86cd799439011",
      tenantId: "507f1f77bcf86cd799439022",
      email: "operator@test.local",
      username: "op1",
      roles: ["operator"]
    });
  });

  it("GET proxies without advisor/operator gate", async () => {
    const req = new Request("http://test/api/strategy-jobs");
    const res = await getStrategyJobs(req);
    expect(res.status).toBe(200);
    expect(bffMocks.proxyRequestToBackend).toHaveBeenCalledWith(req);
    expect(authMocks.requireSessionUser).not.toHaveBeenCalled();
  });

  it("POST returns auth response when session is missing", async () => {
    authMocks.requireSessionUser.mockResolvedValueOnce(
      NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    );
    const req = new Request("http://test/api/strategy-jobs", { method: "POST" });
    const res = await postStrategyJobs(req);
    expect(res.status).toBe(401);
    expect(bffMocks.proxyRequestToBackend).not.toHaveBeenCalled();
  });

  it("POST blocks viewer role", async () => {
    authMocks.requireSessionUser.mockResolvedValueOnce({
      userId: "507f1f77bcf86cd799439011",
      tenantId: "507f1f77bcf86cd799439022",
      email: "viewer@test.local",
      username: "viewer1",
      roles: ["viewer"]
    });
    const req = new Request("http://test/api/strategy-jobs", { method: "POST" });
    const res = await postStrategyJobs(req);
    const payload = (await res.json()) as { error: string };
    expect(res.status).toBe(403);
    expect(payload.error).toBe("forbidden");
    expect(bffMocks.proxyRequestToBackend).not.toHaveBeenCalled();
  });

  it("POST allows advisor/operator and proxies to backend", async () => {
    bffMocks.proxyRequestToBackend.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          data: {
            jobId: "job_123",
            correlationId: "corr_123"
          }
        }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      )
    );
    const req = new Request("http://test/api/strategy-jobs", { method: "POST" });
    const res = await postStrategyJobs(req);
    expect(res.status).toBe(200);
    expect(authMocks.requireSessionUser).toHaveBeenCalled();
    expect(bffMocks.proxyRequestToBackend).toHaveBeenCalledWith(req);
  });
});
