import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("redis", () => ({
  createClient: vi.fn()
}));

import { createClient } from "redis";

import {
    checkRedisHealth,
    getRedisClient,
    getRedisConnectTimeoutMs,
    getRedisConnectionUrl,
    getRedisQuoteCacheTtlSeconds,
    isLikelyRedisTlsPlainMismatch,
    logRedisStartupHealthCheck,
    resetRedisClientForTests
} from "@/lib/redis-client";

describe("redis-client", () => {
  beforeEach(async () => {
    delete process.env.REDIS_URL;
    delete process.env.REDIS_TLS;
    delete process.env.REDIS_CONNECT_TIMEOUT_MS;
    delete process.env.REDIS_QUOTE_CACHE_TTL_SECONDS;
    await resetRedisClientForTests();
  });

  afterEach(async () => {
    delete process.env.REDIS_URL;
    delete process.env.REDIS_TLS;
    delete process.env.REDIS_CONNECT_TIMEOUT_MS;
    delete process.env.REDIS_QUOTE_CACHE_TTL_SECONDS;
    await resetRedisClientForTests();
    vi.clearAllMocks();
  });

  it("getRedisConnectionUrl returns undefined when unset", () => {
    expect(getRedisConnectionUrl()).toBeUndefined();
  });

  it("isLikelyRedisTlsPlainMismatch detects OpenSSL plain/TLS mismatch", () => {
    expect(
      isLikelyRedisTlsPlainMismatch(
        "error:0A0000C6:SSL routines:tls_get_more_records:packet length too long"
      )
    ).toBe(true);
    expect(isLikelyRedisTlsPlainMismatch("WRONGPASS invalid username-password pair")).toBe(false);
  });

  it("getRedisClient retries rediss:// with redis:// after TLS/plain mismatch", async () => {
    process.env.REDIS_URL = "rediss://default:secret@example.com:14617";
    const bad = {
      connect: vi
        .fn()
        .mockRejectedValue(
          new Error(
            "error:0A0000C6:SSL routines:tls_get_more_records:packet length too long:ssl/record/methods/tls_common.c:661"
          )
        ),
      disconnect: vi.fn().mockResolvedValue(undefined),
      on: vi.fn()
    };
    const good = {
      connect: vi.fn().mockResolvedValue(undefined),
      ping: vi.fn().mockResolvedValue("PONG"),
      disconnect: vi.fn().mockResolvedValue(undefined),
      on: vi.fn()
    };
    vi.mocked(createClient).mockReturnValueOnce(bad as never).mockReturnValueOnce(good as never);

    const c = await getRedisClient();
    expect(c).toBe(good);
    expect(createClient).toHaveBeenCalledTimes(2);
    expect(createClient).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        url: process.env.REDIS_URL,
        socket: expect.objectContaining({ connectTimeout: 750 })
      })
    );
    expect(createClient).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        url: "redis://default:secret@example.com:14617",
        socket: expect.objectContaining({ connectTimeout: 750 })
      })
    );
  });

  it("getRedisConnectionUrl accepts redis:// and rediss://", () => {
    process.env.REDIS_URL = "redis://127.0.0.1:6379";
    expect(getRedisConnectionUrl()).toBe("redis://127.0.0.1:6379");
    process.env.REDIS_URL = "rediss://default:secret@example.com:14617";
    expect(getRedisConnectionUrl()).toContain("rediss://");
  });

  it("getRedisConnectionUrl forces plain redis:// when REDIS_TLS=false", () => {
    process.env.REDIS_URL = "rediss://default:secret@example.com:14617";
    process.env.REDIS_TLS = "false";
    expect(getRedisConnectionUrl()).toBe("redis://default:secret@example.com:14617");
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

  it("getRedisConnectTimeoutMs clamps and defaults", () => {
    expect(getRedisConnectTimeoutMs()).toBe(750);
    process.env.REDIS_CONNECT_TIMEOUT_MS = "1200";
    expect(getRedisConnectTimeoutMs()).toBe(1200);
    process.env.REDIS_CONNECT_TIMEOUT_MS = "10";
    expect(getRedisConnectTimeoutMs()).toBe(100);
    process.env.REDIS_CONNECT_TIMEOUT_MS = "99999";
    expect(getRedisConnectTimeoutMs()).toBe(10_000);
  });

  it("checkRedisHealth skips when URL missing", async () => {
    const h = await checkRedisHealth();
    expect(h.status).toBe("skipped");
  });

  it("logRedisStartupHealthCheck logs ok when ping succeeds", async () => {
    process.env.REDIS_URL = "redis://127.0.0.1:6379";
    vi.mocked(createClient).mockReturnValue({
      connect: vi.fn().mockResolvedValue(undefined),
      ping: vi.fn().mockResolvedValue("PONG"),
      on: vi.fn(),
      quit: vi.fn().mockResolvedValue(undefined),
      disconnect: vi.fn().mockResolvedValue(undefined)
    } as never);
    const info = vi.spyOn(console, "info").mockImplementation(() => {});
    await logRedisStartupHealthCheck();
    expect(info).toHaveBeenCalledWith(
      expect.stringMatching(/\[startup\/redis\/(control|cache)\] ok ping latencyMs=\d+/)
    );
    info.mockRestore();
  });

  it("logRedisStartupHealthCheck logs skipped when URL missing", async () => {
    const info = vi.spyOn(console, "info").mockImplementation(() => {});
    await logRedisStartupHealthCheck();
    expect(info).toHaveBeenCalledWith(
      expect.stringContaining("skipped — REDIS_URL unset or invalid")
    );
    expect(info).toHaveBeenCalledWith(
      expect.stringContaining("[startup/redis/control]")
    );
    expect(info).toHaveBeenCalledWith(
      expect.stringContaining("[startup/redis/cache]")
    );
    info.mockRestore();
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
