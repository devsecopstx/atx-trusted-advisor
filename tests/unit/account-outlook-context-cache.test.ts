import { afterEach, describe, expect, it, vi } from "vitest";

import type { AccountOutlookContextForXchat } from "@/modules/xchat/account-outlook-context";
import {
    buildAccountOutlookContextCacheKey,
    getAccountOutlookContextCacheTtlSeconds,
    invalidateAccountOutlookContextCache,
    readAccountOutlookContextCache,
    writeAccountOutlookContextCache
} from "@/modules/xchat/account-outlook-context-cache";

vi.mock("@/lib/redis-client", () => ({
  getRedisClientForPlane: vi.fn().mockResolvedValue(null)
}));

const sampleCtx: AccountOutlookContextForXchat = {
  marketOutlook: "neutral",
  marketOutlookLabel: "Neutral",
  riskLevel: "balanced",
  riskLevelLabel: "Balanced",
  outlookConfidence: 0.82,
  lastOutlookRefreshAt: new Date("2026-05-10T12:00:00.000Z"),
  outlookRefreshSource: "manual",
  outlookNotes: null,
  accountOutlookRefreshEnabled: true,
  guardrailMaxPositionPct: 12,
  stableFingerprint: "abc123",
  promptInjection: "Account desk context"
};

describe("account-outlook-context-cache", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("builds tenant-scoped cache keys", () => {
    expect(
      buildAccountOutlookContextCacheKey({
        tenantId: "tenant1",
        userId: "user1",
        portfolioIdHex: "507f1f77bcf86cd799439011"
      })
    ).toBe("outlook:ctx:tenant1:user1:507f1f77bcf86cd799439011");
  });

  it("round-trips outlook context through in-memory cache", async () => {
    const key = buildAccountOutlookContextCacheKey({
      userId: "user1",
      portfolioIdHex: "507f1f77bcf86cd799439011"
    });
    await writeAccountOutlookContextCache(key, sampleCtx, 60);
    const hit = await readAccountOutlookContextCache(key);
    expect(hit?.marketOutlookLabel).toBe("Neutral");
    expect(hit?.lastOutlookRefreshAt?.toISOString()).toBe("2026-05-10T12:00:00.000Z");
    await invalidateAccountOutlookContextCache({
      userId: "user1",
      portfolioIdHex: "507f1f77bcf86cd799439011"
    });
    const miss = await readAccountOutlookContextCache(key);
    expect(miss).toBeNull();
  });

  it("clamps TTL from env", () => {
    vi.stubEnv("REDIS_OUTLOOK_CONTEXT_TTL_SECONDS", "15");
    expect(getAccountOutlookContextCacheTtlSeconds()).toBe(30);
    vi.stubEnv("REDIS_OUTLOOK_CONTEXT_TTL_SECONDS", "1200");
    expect(getAccountOutlookContextCacheTtlSeconds()).toBe(900);
  });
});
