import { ObjectId } from "mongodb";
import { describe, expect, it } from "vitest";

import { computeScannerOptionChainCacheKey } from "@/modules/scanner/scanner-option-chain-cache";

describe("computeScannerOptionChainCacheKey", () => {
  it("is stable for same tenant + underlying + expiration", () => {
    const oid = new ObjectId("507f1f77bcf86cd799439011");
    const a = computeScannerOptionChainCacheKey(oid, "tsla", "2026-06-20");
    const b = computeScannerOptionChainCacheKey(oid, "tsla", "2026-06-20");
    expect(a).toBe(b);
    expect(a).toMatch(/^[a-f0-9]{64}$/);
  });

  it("differs when tenant differs", () => {
    const t1 = new ObjectId("507f1f77bcf86cd799439011");
    const t2 = new ObjectId("507f1f77bcf86cd799439012");
    const k1 = computeScannerOptionChainCacheKey(t1, "AAPL", "2026-01-15");
    const k2 = computeScannerOptionChainCacheKey(t2, "AAPL", "2026-01-15");
    expect(k1).not.toBe(k2);
  });

  it("uses global scope when tenant omitted", () => {
    const k = computeScannerOptionChainCacheKey(undefined, "MSFT", "2026-03-01");
    expect(k).toBe(computeScannerOptionChainCacheKey(undefined, "MSFT", "2026-03-01"));
  });
});
