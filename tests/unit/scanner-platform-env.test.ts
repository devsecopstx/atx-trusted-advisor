import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
    isOptionsChainCacheEnabled,
    isScannerCircuitBreakerEnabled,
    optionsChainCacheTtlSeconds,
    scannerCircuitCooldownSeconds,
    scannerCircuitFailureThreshold
} from "@/modules/scanner/scanner-platform-env";

const KEYS = [
  "OPTIONS_CHAIN_CACHE_ENABLED",
  "OPTIONS_CHAIN_CACHE_TTL_SEC",
  "SCANNER_CIRCUIT_BREAKER_ENABLED",
  "SCANNER_CIRCUIT_COOLDOWN_SEC",
  "SCANNER_CIRCUIT_FAILURE_THRESHOLD"
] as const;

const ORIGINAL: Record<string, string | undefined> = {};
for (const k of KEYS) {
  ORIGINAL[k] = process.env[k];
}

describe("scanner-platform-env", () => {
  beforeEach(() => {
    for (const k of KEYS) {
      delete process.env[k];
    }
  });

  afterEach(() => {
    for (const k of KEYS) {
      if (ORIGINAL[k] === undefined) {
        delete process.env[k];
      } else {
        process.env[k] = ORIGINAL[k];
      }
    }
  });

  it("defaults: cache on, 15m TTL, breaker on, 15m cooldown, threshold 3", () => {
    expect(isOptionsChainCacheEnabled()).toBe(true);
    expect(optionsChainCacheTtlSeconds()).toBe(900);
    expect(isScannerCircuitBreakerEnabled()).toBe(true);
    expect(scannerCircuitCooldownSeconds()).toBe(900);
    expect(scannerCircuitFailureThreshold()).toBe(3);
  });

  it("respects explicit OPTIONS_CHAIN_CACHE_TTL_SEC", () => {
    process.env.OPTIONS_CHAIN_CACHE_TTL_SEC = "120";
    expect(optionsChainCacheTtlSeconds()).toBe(120);
  });

  it("clamps invalid TTL to default", () => {
    process.env.OPTIONS_CHAIN_CACHE_TTL_SEC = "30";
    expect(optionsChainCacheTtlSeconds()).toBe(900);
  });

  it("disables cache when OPTIONS_CHAIN_CACHE_ENABLED=false", () => {
    process.env.OPTIONS_CHAIN_CACHE_ENABLED = "false";
    expect(isOptionsChainCacheEnabled()).toBe(false);
  });

  it("respects failure threshold override", () => {
    process.env.SCANNER_CIRCUIT_FAILURE_THRESHOLD = "5";
    expect(scannerCircuitFailureThreshold()).toBe(5);
  });
});
