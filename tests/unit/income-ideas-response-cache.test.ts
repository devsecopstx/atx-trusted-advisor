import { describe, expect, it } from "vitest";

import {
    __resetIncomeIdeasResponseCacheForTest,
    buildIncomeIdeasResponseCacheKey,
    getIncomeIdeasResponseCacheTtlSeconds,
    setIncomeIdeasResponseCache,
    tryGetIncomeIdeasResponseCache
} from "@/modules/xchat/income-ideas-response-cache";
import type { WorkspaceSnapshotPreload } from "@/modules/xchat/workspace-snapshot-for-prompt";

describe("income-ideas-response-cache", () => {
  it("buildIncomeIdeasResponseCacheKey is stable for same preload", () => {
    const preload: WorkspaceSnapshotPreload = {
      promptJson: {
        loadedAt: "2026-05-10T00:00:00.000Z",
        workspaceContentRev: 2,
        portfolio: {
          id: "507f1f77bcf86cd799439011",
          name: "Main",
          isDefault: true,
          totalPositionCount: 1
        },
        accounts: [],
        positionsPreview: [],
        positionsPreviewTruncated: false,
        positionsOmittedCount: 0,
        watchlist: {
          name: "WL",
          riskProfile: null,
          outlook: null,
          symbols: [{ symbol: "AAPL" }]
        }
      },
      positionsFull: [
        {
          symbol: "TSLA",
          qty: 10,
          avgCost: 100,
          accountId: "507f1f77bcf86cd799439012",
          positionType: "stock"
        }
      ]
    };
    const a = buildIncomeIdeasResponseCacheKey({
      tenantIdHex: "t1",
      userIdHex: "u1",
      preload,
      personaIdHex: "p1",
      executionModel: "grok-test"
    });
    const b = buildIncomeIdeasResponseCacheKey({
      tenantIdHex: "t1",
      userIdHex: "u1",
      preload,
      personaIdHex: "p1",
      executionModel: "grok-test"
    });
    expect(a).toBe(b);
    expect(a.startsWith("xf:xchat:income_ideas_resp:v1:")).toBe(true);
  });

  it("in-memory set/get roundtrip when Redis unavailable", async () => {
    __resetIncomeIdeasResponseCacheForTest();
    const key = "xf:xchat:income_ideas_resp:v1:testmem";
    await setIncomeIdeasResponseCache(key, '{"ideas":[]}', 600);
    const hit = await tryGetIncomeIdeasResponseCache(key);
    expect(hit).toBe('{"ideas":[]}');
    __resetIncomeIdeasResponseCacheForTest();
  });

  it("getIncomeIdeasResponseCacheTtlSeconds clamps", async () => {
    const prev = process.env.REDIS_INCOME_IDEAS_RESPONSE_CACHE_TTL_SECONDS;
    process.env.REDIS_INCOME_IDEAS_RESPONSE_CACHE_TTL_SECONDS = "999999";
    expect(getIncomeIdeasResponseCacheTtlSeconds()).toBe(1800);
    process.env.REDIS_INCOME_IDEAS_RESPONSE_CACHE_TTL_SECONDS = "10";
    expect(getIncomeIdeasResponseCacheTtlSeconds()).toBe(300);
    if (prev === undefined) {
      delete process.env.REDIS_INCOME_IDEAS_RESPONSE_CACHE_TTL_SECONDS;
    } else {
      process.env.REDIS_INCOME_IDEAS_RESPONSE_CACHE_TTL_SECONDS = prev;
    }
  });
});
