import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const redisMocks = vi.hoisted(() => ({
  getRedisClientForPlane: vi.fn(async () => null as null | { get: ReturnType<typeof vi.fn>; set: ReturnType<typeof vi.fn> })
}));

vi.mock("@/lib/redis-client", () => redisMocks);

import {
    __resetOptionsScanCacheForTest,
    buildOptionsScanFingerprint,
    getOptionsScanCacheTtlSeconds,
    setOptionsScanCache,
    tryGetOptionsScanCache
} from "@/modules/xchat/options-scan-redis-cache";

beforeEach(() => {
  __resetOptionsScanCacheForTest();
  redisMocks.getRedisClientForPlane.mockReset();
});

afterEach(() => {
  delete process.env.REDIS_OPTIONS_SCAN_CACHE_TTL_SECONDS;
});

describe("buildOptionsScanFingerprint", () => {
  it("is stable for same symbol + filters and changes when either changes", () => {
    const a = buildOptionsScanFingerprint({ symbol: "tsla", filters: { minDte: 7, maxDte: 30 } });
    const b = buildOptionsScanFingerprint({ symbol: "TSLA", filters: { minDte: 7, maxDte: 30 } });
    const c = buildOptionsScanFingerprint({ symbol: "TSLA", filters: { minDte: 7, maxDte: 60 } });
    expect(a).toBe(b);
    expect(a).not.toBe(c);
    expect(a.length).toBe(32);
  });
});

describe("getOptionsScanCacheTtlSeconds", () => {
  it("defaults to 60 and clamps user input to 5..600", () => {
    expect(getOptionsScanCacheTtlSeconds()).toBe(60);
    process.env.REDIS_OPTIONS_SCAN_CACHE_TTL_SECONDS = "9999";
    expect(getOptionsScanCacheTtlSeconds()).toBe(600);
    process.env.REDIS_OPTIONS_SCAN_CACHE_TTL_SECONDS = "1";
    expect(getOptionsScanCacheTtlSeconds()).toBe(5);
    process.env.REDIS_OPTIONS_SCAN_CACHE_TTL_SECONDS = "abc";
    expect(getOptionsScanCacheTtlSeconds()).toBe(60);
  });
});

describe("options_scan cache memory fallback", () => {
  it("round-trips through in-memory map when redis client is null", async () => {
    redisMocks.getRedisClientForPlane.mockResolvedValue(null);
    const fp = "test-fingerprint";
    expect(await tryGetOptionsScanCache(fp)).toBeNull();
    await setOptionsScanCache(fp, JSON.stringify({ ok: true }), 60);
    const hit = await tryGetOptionsScanCache(fp);
    expect(hit).toBe(JSON.stringify({ ok: true }));
  });

  it("uses redis when client is present", async () => {
    const get = vi.fn(async () => JSON.stringify({ ok: 1 }));
    const set = vi.fn(async () => "OK");
    redisMocks.getRedisClientForPlane.mockResolvedValue({ get, set });
    const hit = await tryGetOptionsScanCache("fp1");
    expect(hit).toBe(JSON.stringify({ ok: 1 }));
    expect(get).toHaveBeenCalledWith("xf:xchat:options_scan:v1:fp1");
    await setOptionsScanCache("fp1", JSON.stringify({ rows: [] }), 90);
    expect(set).toHaveBeenCalledWith("xf:xchat:options_scan:v1:fp1", JSON.stringify({ rows: [] }), { EX: 90 });
  });

  it("does not write when ttl is zero or negative", async () => {
    redisMocks.getRedisClientForPlane.mockResolvedValue(null);
    await setOptionsScanCache("fp2", "{}", 0);
    expect(await tryGetOptionsScanCache("fp2")).toBeNull();
  });
});
