import { describe, expect, it } from "vitest";

import {
    mergeOptionsStrategyFilters
} from "@/modules/strategy-options/options-scanner-prefs-filter";
import {
    parseTenantOptionsStrategyEngineConfigStored,
    resolveEffectiveTenantOptionsStrategyEngineConfig,
    resolveScannerMergedFiltersForTenant
} from "@/modules/strategy-options/tenant-options-strategy-engine-config";

describe("tenant-options-strategy-engine-config", () => {
  it("uses product defaults when tenant has no override", () => {
    const effective = resolveEffectiveTenantOptionsStrategyEngineConfig(null);
    expect(effective.scanner.minIvRankPct).toBe(45);
    expect(effective.engine.straddleDeltaMin).toBe(0.15);
    expect(effective.engine.straddleDeltaMax).toBe(0.3);
    expect(effective.overrideEnabled).toBe(false);
  });

  it("parses tenant scanner + engine overrides", () => {
    const parsed = parseTenantOptionsStrategyEngineConfigStored({
      overrideEnabled: true,
      scanner: { minIvRankPct: 50, minDte: 21, maxDte: 45, underlyingDenylist: ["tsla"] },
      engine: { straddleDeltaMin: 0.18, straddleDeltaMax: 0.28, minFitScore: 75 }
    });
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    const effective = resolveEffectiveTenantOptionsStrategyEngineConfig({
      tenantPreferences: { options_strategy_engine: parsed.value ?? undefined }
    });
    expect(effective.overrideEnabled).toBe(true);
    expect(effective.scanner.minIvRankPct).toBe(50);
    expect(effective.scanner.underlyingDenylist).toEqual(["TSLA"]);
    expect(effective.engine.minFitScore).toBe(75);
  });

  it("rejects invalid straddle delta band", () => {
    const parsed = parseTenantOptionsStrategyEngineConfigStored({
      engine: { straddleDeltaMin: 0.4, straddleDeltaMax: 0.2 }
    });
    expect(parsed.ok).toBe(false);
  });

  it("tenant override replaces catalog merge when enabled", () => {
    const catalog = mergeOptionsStrategyFilters([
      { slug: "wheel", filters: { minIvRankPct: 45, minDte: 10 } }
    ]);
    const resolved = resolveScannerMergedFiltersForTenant({
      catalogMerged: catalog,
      tenant: {
        tenantPreferences: {
          options_strategy_engine: {
            overrideEnabled: true,
            scanner: { minIvRankPct: 55, minDte: 21, maxDte: 60 }
          }
        }
      }
    });
    expect(resolved.minIvRankPct).toBe(55);
    expect(resolved.merged.minDte).toBe(21);
    expect(resolved.merged.maxDte).toBe(60);
  });

  it("raises IV floor from tenant when override disabled", () => {
    const catalog = mergeOptionsStrategyFilters([]);
    const resolved = resolveScannerMergedFiltersForTenant({
      catalogMerged: catalog,
      tenant: {
        tenantPreferences: {
          options_strategy_engine: {
            scanner: { minIvRankPct: 52 }
          }
        }
      }
    });
    expect(resolved.minIvRankPct).toBe(52);
    expect(resolved.effective.overrideEnabled).toBe(false);
  });
});
