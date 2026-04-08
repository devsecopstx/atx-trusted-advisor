import { describe, expect, it, vi } from "vitest";

const authMocks = vi.hoisted(() => ({
  requireAdminSession: vi.fn()
}));

const mongoMocks = vi.hoisted(() => ({
  getDb: vi.fn()
}));

const redisMocks = vi.hoisted(() => ({
  checkRedisHealth: vi.fn()
}));

const envMocks = vi.hoisted(() => ({
  getAtxfinanceBackendOrigin: vi.fn()
}));

const auditMocks = vi.hoisted(() => ({
  createAuditEvent: vi.fn()
}));

vi.mock("@/lib/api-auth", () => authMocks);
vi.mock("@/lib/mongodb", () => mongoMocks);
vi.mock("@/lib/redis-client", () => redisMocks);
vi.mock("@/lib/env", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/env")>();
  return { ...actual, getAtxfinanceBackendOrigin: envMocks.getAtxfinanceBackendOrigin };
});
vi.mock("@/modules/audit/repository", () => auditMocks);

import { GET as getOpsSummary } from "@/app/api/admin/system/ops-summary/route";
import { APP_VERSION } from "@/lib/app-version";
import { NextResponse } from "next/server";

describe("GET /api/admin/system/ops-summary", () => {
  it("returns 401-shaped response when admin session missing", async () => {
    authMocks.requireAdminSession.mockResolvedValueOnce(NextResponse.json({ error: "Unauthorized" }, { status: 401 }));

    const res = await getOpsSummary();
    expect(res.status).toBe(401);
  });

  it("returns next app + skipped backend when origin unset", async () => {
    authMocks.requireAdminSession.mockResolvedValue({
      userId: "u1",
      email: "a@b.c",
      username: "ab",
      tenantId: "507f1f77bcf86cd799439011",
      roles: ["global_admin"],
      tenantRole: "tenant_admin",
      xUserId: "x",
      displayName: "A"
    });
    mongoMocks.getDb.mockResolvedValue({
      command: vi.fn().mockResolvedValue({ ok: 1 }),
      databaseName: "atxfinance-test"
    });
    redisMocks.checkRedisHealth.mockResolvedValue({
      status: "skipped",
      reason: "REDIS_URL unset or invalid"
    });
    envMocks.getAtxfinanceBackendOrigin.mockReturnValue(undefined);
    auditMocks.createAuditEvent.mockResolvedValue({});

    const res = await getOpsSummary();
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      sessionTenantId: string;
      nextApp: { version: string; database: { ok: boolean; name: string }; redis: { status: string } };
      backend: { configured: boolean; skippedReason?: string };
    };
    expect(body.sessionTenantId).toBe("507f1f77bcf86cd799439011");
    expect(body.nextApp.version).toBe(APP_VERSION);
    expect(body.nextApp.database.ok).toBe(true);
    expect(body.nextApp.database.name).toBe("atxfinance-test");
    expect(body.nextApp.redis.status).toBe("skipped");
    expect(body.backend.configured).toBe(false);
    expect(body.backend.skippedReason).toMatch(/ATXFINANCE_BACKEND_ORIGIN unset/);
    expect(auditMocks.createAuditEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        entityId: "ops-summary",
        action: "ops_summary_viewed"
      })
    );
  });

  it("merges Spring /api/backend/health when origin set", async () => {
    authMocks.requireAdminSession.mockResolvedValue({
      userId: "u1",
      email: "a@b.c",
      username: "ab",
      tenantId: "507f1f77bcf86cd799439011",
      roles: ["global_admin"],
      tenantRole: "tenant_admin",
      xUserId: "x",
      displayName: "A"
    });
    mongoMocks.getDb.mockResolvedValue({
      command: vi.fn().mockResolvedValue({ ok: 1 }),
      databaseName: "atxfinance-test"
    });
    redisMocks.checkRedisHealth.mockResolvedValue({ status: "ok", latencyMs: 3 });
    envMocks.getAtxfinanceBackendOrigin.mockReturnValue("https://backend.example");
    auditMocks.createAuditEvent.mockResolvedValue({});

    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          status: "ok",
          service: "atxfinance-backend",
          time: "2026-01-01T00:00:00Z",
          details: {
            mongo: { status: "ok" },
            redis: { status: "skipped", reason: "REDIS_URL not set or Redis disabled" }
          }
        }),
        { status: 200 }
      )
    );

    const res = await getOpsSummary();
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      backend: { mongoStatus?: string; redisStatus?: string; httpReachable: boolean };
    };
    expect(body.backend.httpReachable).toBe(true);
    expect(body.backend.mongoStatus).toBe("ok");
    expect(body.backend.redisStatus).toBe("skipped");
    expect(fetchSpy).toHaveBeenCalledWith(
      "https://backend.example/api/backend/health",
      expect.objectContaining({ method: "GET" })
    );

    fetchSpy.mockRestore();
  });
});
