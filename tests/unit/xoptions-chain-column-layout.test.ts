import { describe, expect, it } from "vitest";

import {
    normalizeColumnOrder,
    parseSavedLayout,
    savedMatchesPreset,
    serializeSavedLayout,
    visibleOrderedColumnsFromSaved,
    type XoptionsChainDataColumnId,
    type XoptionsChainSavedLayout
} from "@/lib/xoptions/xoptions-chain-column-layout";

describe("xoptions-chain-column-layout", () => {
  it("normalizes order to include every id exactly once", () => {
    const scrambled: XoptionsChainDataColumnId[] = [
      "vega",
      "strike",
      "bid",
      "ask",
      "mid",
      "last",
      "iv",
      "volume",
      "oi",
      "delta",
      "gamma",
      "theta",
      "be"
    ];
    const out = normalizeColumnOrder(scrambled);
    expect(out).toEqual(scrambled);
    expect(new Set(out).size).toBe(13);
  });

  it("fills missing ids at the end when order is partial", () => {
    const out = normalizeColumnOrder(["strike", "bid"]);
    expect(out[0]).toBe("strike");
    expect(out[1]).toBe("bid");
    expect(out).toContain("vega");
    expect(out).toHaveLength(13);
  });

  it("drops duplicate ids", () => {
    const out = normalizeColumnOrder(["strike", "strike", "bid", "bid"]);
    expect(out.filter((x) => x === "strike")).toHaveLength(1);
  });

  it("default preset shows standard institutional column order", () => {
    const saved: XoptionsChainSavedLayout = { kind: "preset", preset: "default" };
    const vis = visibleOrderedColumnsFromSaved(saved);
    expect(vis[0]).toBe("strike");
    expect(vis).toContain("last");
    expect(vis).toContain("be");
    expect(vis).toHaveLength(13);
  });

  it("liquidity preset hides Greeks", () => {
    const saved: XoptionsChainSavedLayout = { kind: "preset", preset: "liquidity" };
    const vis = visibleOrderedColumnsFromSaved(saved);
    expect(vis).not.toContain("delta");
    expect(vis).toContain("volume");
    expect(vis).toContain("oi");
  });

  it("custom layout respects hidden set", () => {
    const saved: XoptionsChainSavedLayout = {
      kind: "custom",
      order: normalizeColumnOrder(["strike", "bid", "ask"]),
      hidden: ["be", "vega"]
    };
    const vis = visibleOrderedColumnsFromSaved(saved);
    expect(vis).not.toContain("be");
    expect(vis).not.toContain("vega");
    expect(vis).toContain("strike");
  });

  it("round-trips parse/serialize", () => {
    const saved: XoptionsChainSavedLayout = { kind: "preset", preset: "greeks" };
    expect(parseSavedLayout(serializeSavedLayout(saved))).toEqual(saved);
  });

  it("savedMatchesPreset is true only for matching preset kind", () => {
    expect(savedMatchesPreset({ kind: "preset", preset: "default" }, "default")).toBe(true);
    expect(savedMatchesPreset({ kind: "preset", preset: "default" }, "advanced")).toBe(false);
    expect(
      savedMatchesPreset(
        { kind: "custom", order: normalizeColumnOrder(["strike"]), hidden: [] },
        "default"
      )
    ).toBe(false);
  });
});
