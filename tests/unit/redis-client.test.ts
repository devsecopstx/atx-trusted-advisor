import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("redis", () => ({
  createClient: vi.fn()
}));

import { createClient } from "redis";

import {
  checkRedisHealth,
  getRedisConnectionUrl,
  getRedisQuoteCacheTtlSeconds,
  resetRedisClientForTests
} from "@/lib/redis-client";

describe("redis-client", () => {
  afterEach(async () => {
    delete process.env.REDIS_URL;
    delete process.env.REDIS_QUOTE_CACHE_TTL_SECONDS;
    await resetRedisClientForTests();
    vi.clearAllMocks();
  });

  it("getRedisConnectionUrl returns undefined when unset", () => {
    expect(getRedisConnectionUrl()).toBeUndefined();
  });

  it("getRedisConnectionUrl accepts redis:// and rediss://", () => {
    process.env.REDIS_URL = "redis://127.0.0.1:6379";
    expect(getRedisConnectionUrl()).toBe("redis://127.0.0.1:6379");
    process.env.REDIS_URL = "rediss://default:secret@example.com:14617";
    expect(getRedisConnectionUrl()).toContain("rediss://");
  });

  it("getRedisQuoteCacheTtlSeconds clamps and defaults", () => {
    expect(getRedisQuoteCacheTtlSeconds()).toBe(30);
    process.env.REDIS_QUOTE_CACHE_TTL_SECONDS = "10";
    expect(getRedisQuoteCacheTtlSeconds()).toBe(10);
    process.env.REDIS_QUOTE_CACHE_TTL_SECONDS = "2";
    expect(getRedisQuoteCacheTtlSeconds()).toBe(5);
    process.env.REDIS_QUOTE_CACHE_TTL_SECONDS = "99999";
    expect(getRedisQuoteCacheTtlSeconds()).toBe(3600);
  });

  it("checkRedisHealth skips when URL missing", async () => {
    const h = await checkRedisHealth();
    expect(h.status).toBe("skipped");
  });

  it("checkRedisHealth pings when client connects", async () => {
    process.env.REDIS_URL = "redis://127.0.0.1:6379";
    vi.mocked(createClient).mockReturnValue({
      connect: vi.fn().mockResolvedValue(undefined),
      ping: vi.fn().mockResolvedValue("PONG"),
      on: vi.fn(),
      quit: vi.fn().mockResolvedValue(undefined),
      disconnect: vi.fn().mockResolvedValue(undefined)
    } as never);

    const h = await checkRedisHealth();
    expect(h.status).toBe("ok");
    if (h.status === "ok") {
      expect(h.latencyMs).toBeGreaterThanOrEqual(0);
    }
  });
});
