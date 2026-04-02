import { describe, expect, it } from "vitest";

import {
    inferSideFromWatchlistStrategy,
    parseOccOptionSymbol
} from "@/modules/strategy-options/options-scanner-targets";

describe("parseOccOptionSymbol", () => {
  it("parses Yahoo OCC ticker", () => {
    const p = parseOccOptionSymbol("TSLA260327C00370000");
    expect(p).not.toBeNull();
    expect(p?.underlying).toBe("TSLA");
    expect(p?.expYmd).toBe("2026-03-27");
    expect(p?.optionType).toBe("call");
    expect(p?.strike).toBe(370);
  });

  it("returns null for equity ticker", () => {
    expect(parseOccOptionSymbol("TSLA")).toBeNull();
  });
});

describe("inferSideFromWatchlistStrategy", () => {
  it("detects covered call as short call", () => {
    expect(inferSideFromWatchlistStrategy("Covered Call", "Option", "call")).toBe("short");
  });

  it("detects CSP as short put", () => {
    expect(inferSideFromWatchlistStrategy("CSP", "Option", "put")).toBe("short");
  });
});
