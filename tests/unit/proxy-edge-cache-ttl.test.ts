import { describe, expect, it } from "vitest";

import {
  parseProxyEdgeCacheTtlMs,
  parseSessionGroundingRedisTtlSeconds
} from "@/lib/proxy-edge-cache-ttl";

describe("proxy-edge-cache-ttl", () => {
  it("parseProxyEdgeCacheTtlMs uses default when unset", () => {
    expect(parseProxyEdgeCacheTtlMs(undefined, 60_000)).toBe(60_000);
  });

  it("parseProxyEdgeCacheTtlMs clamps to bounds", () => {
    expect(parseProxyEdgeCacheTtlMs("1000", 60_000)).toBe(5_000);
    expect(parseProxyEdgeCacheTtlMs("999999", 60_000)).toBe(300_000);
    expect(parseProxyEdgeCacheTtlMs("45000", 60_000)).toBe(45_000);
  });

  it("parseSessionGroundingRedisTtlSeconds clamps", () => {
    expect(parseSessionGroundingRedisTtlSeconds("5")).toBe(15);
    expect(parseSessionGroundingRedisTtlSeconds("120")).toBe(120);
    expect(parseSessionGroundingRedisTtlSeconds("9999")).toBe(300);
  });
});
