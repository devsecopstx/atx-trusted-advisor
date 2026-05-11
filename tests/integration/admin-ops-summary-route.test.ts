import { beforeEach, describe, expect, it, vi } from "vitest";

const authMocks = vi.hoisted(() => ({
  requirePlatformOpsSession: vi.fn()
}));

const platformOpsMocks = vi.hoisted(() => ({
  collectPlatformOpsMetrics: vi.fn()
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

const outlookCacheMocks = vi.hoisted(() => ({
  getAccountOutlookContextCacheStats: vi.fn()
}));

vi.mock("@/lib/api-auth", () => ({
  requirePlatformOpsSession: authMocks.requirePlatformOpsSession
}));
vi.mock("@/lib/mongodb", () => mongoMocks);
vi.mock("@/lib/redis-client", () => redisMocks);
vi.mock("@/lib/env", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/env")>();
  return { ...actual, getAtxfinanceBackendOrigin: envMocks.getAtxfinanceBackendOrigin };
});
vi.mock("@/modules/audit/repository", () => auditMocks);
vi.mock("@/modules/admin/platform-ops-metrics", () => ({
  collectPlatformOpsMetrics: platformOpsMocks.collectPlatformOpsMetrics
}));
vi.mock("@/modules/xchat/account-outlook-context-cache", () => ({
  getAccountOutlookContextCacheStats: outlookCacheMocks.getAccountOutlookContextCacheStats
}));

import { GET as getOpsSummary } from "@/app/api/admin/system/ops-summary/route";
import { APP_VERSION } from "@/lib/app-version";
import { NextResponse } from "next/server";

describe("GET /api/admin/system/ops-summary", () => {
  const stubOutlookCache = {
    hits: 4,
    misses: 1,
    writes: 2,
    invalidations: 1,
    hitRate: 0.8,
    storageBackend: "memory" as const,
    ttlSeconds: 120,
    inMemoryEntries: 1
  };

  const stubPlatformOps = {
    scope: "platform" as const,
    tenantsActive: 0,
    usersRegistered: 0,
    logins24h: 0,
    logins7d: 0,
    xchat: { promptsToday: 0, hourlyPeakToday: 0 },
    lastFiveJobs: [],
    costEstimate: {
      currency: "USD" as const,
      todayTotalUsd: 0,
      monthToDateTotalUsd: 0,
      breakdownToday: { xchatUsd: 0, strategyJobsUsd: 0, cloudRunUsd: 0 },
      breakdownMonthToDate: { xchatUsd: 0, strategyJobsUsd: 0, cloudRunUsd: 0 },
      rates: {
        xaiCostPerPromptUsd: 0.0008,
        strategyJobPerRunUsd: 0.002,
        gcpRunCostPerVcpuHourUsd: 0.0005
      },
      notes: []
    }
  };

  beforeEach(() => {
    outlookCacheMocks.getAccountOutlookContextCacheStats.mockResolvedValue(stubOutlookCache);
  });

  it("returns 401-shaped response when admin session missing", async () => {
    authMocks.requirePlatformOpsSession.mockResolvedValueOnce(
      NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    );

    const res = await getOpsSummary();
    expect(res.status).toBe(401);
  });

  it("returns 403 when viewer session", async () => {
    authMocks.requirePlatformOpsSession.mockResolvedValueOnce(
      NextResponse.json({ error: "Forbidden" }, { status: 403 })
    );
    const res = await getOpsSummary();
    expect(res.status).toBe(403);
  });

  it("returns next app + skipped backend when origin unset", async () => {
    authMocks.requirePlatformOpsSession.mockResolvedValue({
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
    platformOpsMocks.collectPlatformOpsMetrics.mockResolvedValue(stubPlatformOps);

    const res = await getOpsSummary();
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      sessionTenantId: string;
      nextApp: {
        version: string;
        database: { ok: boolean; name: string };
        redis: { status: string };
        outlookContextCache: { hitRate: number | null };
      };
      backend: { configured: boolean; skippedReason?: string };
      platformOps: { scope: string; tenantsActive: number };
    };
    expect(body.sessionTenantId).toBe("507f1f77bcf86cd799439011");
    expect(body.nextApp.version).toBe(APP_VERSION);
    expect(body.nextApp.database.ok).toBe(true);
    expect(body.nextApp.database.name).toBe("atxfinance-test");
    expect(body.nextApp.redis.status).toBe("skipped");
    expect(body.nextApp.outlookContextCache.hitRate).toBe(0.8);
    expect(body.backend.configured).toBe(false);
    expect(body.backend.skippedReason).toMatch(/ATXFINANCE_BACKEND_ORIGIN unset/);
    expect(body.platformOps.scope).toBe("platform");
    expect(auditMocks.createAuditEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        entityId: "ops-summary",
        action: "ops_summary_viewed"
      })
    );
  });

  it("merges Spring /api/backend/health when origin set", async () => {
    authMocks.requirePlatformOpsSession.mockResolvedValue({
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
    platformOpsMocks.collectPlatformOpsMetrics.mockResolvedValue(stubPlatformOps);

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
