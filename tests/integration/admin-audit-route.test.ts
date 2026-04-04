import { NextResponse } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const authMocks = vi.hoisted(() => ({
  requireAdminSession: vi.fn()
}));

const auditMocks = vi.hoisted(() => ({
  listAuditEvents: vi.fn()
}));

const bffMocks = vi.hoisted(() => ({
  proxyRequestToBackend: vi.fn<(request: Request) => Promise<Response | null>>()
}));

const limitMocks = vi.hoisted(() => ({
  checkDistributedRateLimit: vi.fn(),
  extractClientRateLimitKey: vi.fn<(request: Request) => string>()
}));

vi.mock("@/lib/api-auth", () => authMocks);
vi.mock("@/modules/audit/repository", () => auditMocks);
vi.mock("@/lib/backend-bff", () => ({
  proxyRequestToBackend: bffMocks.proxyRequestToBackend
}));
vi.mock("@/lib/distributed-rate-limit", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/distributed-rate-limit")>();
  return {
    ...actual,
    checkDistributedRateLimit: limitMocks.checkDistributedRateLimit,
    extractClientRateLimitKey: limitMocks.extractClientRateLimitKey
  };
});

import { GET as getAuditEvents } from "@/app/api/admin/audit/route";

describe("admin audit route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    bffMocks.proxyRequestToBackend.mockResolvedValue(null);
    limitMocks.extractClientRateLimitKey.mockReturnValue("127.0.0.1");
    limitMocks.checkDistributedRateLimit.mockResolvedValue({
      allowed: true,
      remaining: 5,
      resetAtMs: Date.now() + 60_000,
      retryAfterSeconds: 60,
      source: "memory"
    });
    authMocks.requireAdminSession.mockResolvedValue({
      userId: "507f1f77bcf86cd799439011",
      tenantId: "507f1f77bcf86cd799439022",
      roles: ["global_admin"]
    });
    auditMocks.listAuditEvents.mockResolvedValue([
      {
        _id: { toHexString: () => "507f1f77bcf86cd799439033" },
        entityType: "xpersona",
        entityId: "507f1f77bcf86cd799439044",
        action: "updated",
        actor: {
          userId: "507f1f77bcf86cd799439011",
          email: "admin@atxfinance.ai"
        },
        details: { changedFields: ["systemPrompt"] },
        createdAt: new Date("2026-03-16T00:00:00.000Z")
      }
    ]);
  });

  it("lists audit events with filters", async () => {
    const response = await getAuditEvents(
      new Request(
        "http://test/api/admin/audit?entityType=xpersona&action=updated&actor=admin&limit=25"
      )
    );
    const payload = (await response.json()) as { data: Array<{ action: string }> };

    expect(response.status).toBe(200);
    expect(payload.data[0]?.action).toBe("updated");
    expect(auditMocks.listAuditEvents).toHaveBeenCalledWith(
      expect.objectContaining({
        entityType: "xpersona",
        action: "updated",
        actor: "admin",
        limit: 25
      })
    );
  });

  it("returns auth response for non-admin", async () => {
    authMocks.requireAdminSession.mockResolvedValueOnce(
      NextResponse.json({ error: "Forbidden" }, { status: 403 })
    );

    const response = await getAuditEvents(new Request("http://test/api/admin/audit"));
    expect(response.status).toBe(403);
  });

  it("short-circuits to BFF response without listing from Next repository", async () => {
    bffMocks.proxyRequestToBackend.mockResolvedValueOnce(
      new NextResponse(JSON.stringify({ data: [{ action: "proxied" }] }), { status: 200 })
    );

    const response = await getAuditEvents(new Request("http://test/api/admin/audit"));
    expect(response.status).toBe(200);
    const payload = (await response.json()) as { data: Array<{ action: string }> };
    expect(payload.data[0]?.action).toBe("proxied");
    expect(auditMocks.listAuditEvents).not.toHaveBeenCalled();
    expect(authMocks.requireAdminSession).not.toHaveBeenCalled();
  });

  it("returns 429 when limiter blocks request", async () => {
    limitMocks.checkDistributedRateLimit.mockResolvedValueOnce({
      allowed: false,
      remaining: 0,
      resetAtMs: Date.now() + 20_000,
      retryAfterSeconds: 20,
      source: "memory"
    });
    const response = await getAuditEvents(new Request("http://test/api/admin/audit"));
    expect(response.status).toBe(429);
    expect(authMocks.requireAdminSession).not.toHaveBeenCalled();
    expect(auditMocks.listAuditEvents).not.toHaveBeenCalled();
  });
});
