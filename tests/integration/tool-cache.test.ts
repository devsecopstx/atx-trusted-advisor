import { afterEach, describe, expect, it } from "vitest";

import {
    clearToolCache,
    getCachedToolResult,
    getToolCacheSize,
    setCachedToolResult
} from "@/modules/xchat/tool-cache";

describe("tool output cache", () => {
  afterEach(() => {
    clearToolCache();
  });

  it("returns null for cache miss", () => {
    expect(getCachedToolResult("user_1", "portfolio_summary")).toBeNull();
  });

  it("caches and retrieves result", () => {
    setCachedToolResult("user_1", "portfolio_summary", '{"name":"Default"}');
    expect(getCachedToolResult("user_1", "portfolio_summary")).toBe('{"name":"Default"}');
  });

  it("isolates by user", () => {
    setCachedToolResult("user_1", "portfolio_summary", "data_1");
    setCachedToolResult("user_2", "portfolio_summary", "data_2");
    expect(getCachedToolResult("user_1", "portfolio_summary")).toBe("data_1");
    expect(getCachedToolResult("user_2", "portfolio_summary")).toBe("data_2");
  });

  it("isolates by operation", () => {
    setCachedToolResult("user_1", "portfolio_summary", "portfolio");
    setCachedToolResult("user_1", "watchlist_snapshot", "watchlist");
    expect(getCachedToolResult("user_1", "portfolio_summary")).toBe("portfolio");
    expect(getCachedToolResult("user_1", "watchlist_snapshot")).toBe("watchlist");
  });

  it("isolates by scope key (for selected workspace portfolio)", () => {
    setCachedToolResult("user_1", "watchlist_snapshot", "wl_portfolio_a", undefined, "portfolio_a");
    setCachedToolResult("user_1", "watchlist_snapshot", "wl_portfolio_b", undefined, "portfolio_b");
    expect(getCachedToolResult("user_1", "watchlist_snapshot", "portfolio_a")).toBe("wl_portfolio_a");
    expect(getCachedToolResult("user_1", "watchlist_snapshot", "portfolio_b")).toBe("wl_portfolio_b");
    expect(getCachedToolResult("user_1", "watchlist_snapshot", "portfolio_c")).toBeNull();
  });

  it("expires after TTL", () => {
    setCachedToolResult("user_1", "test_op", "data", 1);
    return new Promise<void>((resolve) => {
      setTimeout(() => {
        expect(getCachedToolResult("user_1", "test_op")).toBeNull();
        resolve();
      }, 10);
    });
  });

  it("clears all entries", () => {
    setCachedToolResult("user_1", "op_a", "a");
    setCachedToolResult("user_2", "op_b", "b");
    expect(getToolCacheSize()).toBe(2);
    clearToolCache();
    expect(getToolCacheSize()).toBe(0);
  });

  it("evicts oldest when at max capacity", () => {
    for (let i = 0; i < 201; i++) {
      setCachedToolResult(`user_${i}`, "op", `data_${i}`);
    }
    expect(getToolCacheSize()).toBeLessThanOrEqual(200);
  });
});
