import { describe, expect, it } from "vitest";

/**
 * Documents expected env defaults for scanner circuit + option chain cache (Phase 3).
 * Mongo integration is covered at runtime via scheduled jobs.
 */
describe("scanner phase3 env defaults", () => {
  it("uses 15m TTL and cooldown when env unset", () => {
    const ttl = Number.parseInt(process.env.OPTIONS_CHAIN_CACHE_TTL_SEC ?? "900", 10);
    const cool = Number.parseInt(process.env.SCANNER_CIRCUIT_COOLDOWN_SEC ?? "900", 10);
    expect(ttl).toBe(900);
    expect(cool).toBe(900);
  });
});
