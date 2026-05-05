import { describe, expect, it } from "vitest";

import {
    DEFAULT_TENANT_BOOTSTRAP_POLICY_V1,
    effectiveTenantBootstrapPolicy,
    normalizeWatchlistSeedSymbolsFromPreferences,
    parseTenantBootstrapPolicyFromUnknown,
    pickBootstrapPlatformRole,
    resolveBootstrapFlagsForRole,
    resolveWatchlistSeedSymbols,
    tenantBootstrapOnApprove
} from "@/modules/platform/tenant-bootstrap-policy";

describe("tenant-bootstrap-policy", () => {
  it("tenantBootstrapOnApprove reads bootstrap_on_approve", () => {
    expect(tenantBootstrapOnApprove(null)).toBe(false);
    expect(tenantBootstrapOnApprove({ bootstrap_on_approve: false })).toBe(false);
    expect(tenantBootstrapOnApprove({ bootstrap_on_approve: true })).toBe(true);
  });

  it("effectiveTenantBootstrapPolicy defaults when unset", () => {
    expect(effectiveTenantBootstrapPolicy(null)).toEqual(DEFAULT_TENANT_BOOTSTRAP_POLICY_V1);
    expect(effectiveTenantBootstrapPolicy({})).toEqual(DEFAULT_TENANT_BOOTSTRAP_POLICY_V1);
  });

  it("effectiveTenantBootstrapPolicy uses embedded bootstrap_policy", () => {
    const custom = {
      defaultPortfolio: { viewer: true, operator: false, advisor: false },
      defaultWatchlist: { viewer: false, operator: false, advisor: false },
      overrides: []
    };
    expect(
      effectiveTenantBootstrapPolicy({
        bootstrap_policy: custom
      })
    ).toEqual(custom);
  });

  it("effectiveTenantBootstrapPolicy maps legacy bootstrap_default_portfolio_watchlist", () => {
    expect(
      effectiveTenantBootstrapPolicy({ bootstrap_default_portfolio_watchlist: false })
    ).toEqual({
      defaultPortfolio: { viewer: false, operator: false, advisor: false },
      defaultWatchlist: { viewer: false, operator: false, advisor: false },
      overrides: []
    });
    expect(
      effectiveTenantBootstrapPolicy({ bootstrap_default_portfolio_watchlist: true })
    ).toEqual({
      defaultPortfolio: { viewer: true, operator: true, advisor: true },
      defaultWatchlist: { viewer: true, operator: true, advisor: true },
      overrides: []
    });
  });

  it("pickBootstrapPlatformRole prefers advisor > operator > viewer", () => {
    expect(pickBootstrapPlatformRole(["viewer", "operator"])).toBe("operator");
    expect(pickBootstrapPlatformRole(["advisor", "operator"])).toBe("advisor");
    expect(pickBootstrapPlatformRole(["viewer"])).toBe("viewer");
    expect(pickBootstrapPlatformRole(["global_admin"])).toBeNull();
  });

  it("parseTenantBootstrapPolicyFromUnknown validates role maps", () => {
    expect(() => parseTenantBootstrapPolicyFromUnknown({})).toThrow(/defaultPortfolio/);
    const valid = {
      defaultPortfolio: { viewer: false, operator: true, advisor: true },
      defaultWatchlist: { viewer: false, operator: true, advisor: true },
      overrides: [{ role: "operator", symbols: ["SPY", "QQQ"] }]
    };
    expect(parseTenantBootstrapPolicyFromUnknown(valid)).toEqual({
      ...valid,
      overrides: [{ role: "operator", symbols: ["SPY", "QQQ"] }]
    });
  });

  it("resolveBootstrapFlagsForRole applies overrides", () => {
    const policy = {
      ...DEFAULT_TENANT_BOOTSTRAP_POLICY_V1,
      overrides: [{ role: "operator", defaultPortfolio: false, symbols: ["NVDA"] }]
    };
    expect(resolveBootstrapFlagsForRole(policy, "operator")).toEqual({
      defaultPortfolio: false,
      defaultWatchlist: true,
      overrideSymbols: ["NVDA"]
    });
  });

  it("normalizeWatchlistSeedSymbolsFromPreferences", () => {
    expect(normalizeWatchlistSeedSymbolsFromPreferences(null)).toBeUndefined();
    expect(
      normalizeWatchlistSeedSymbolsFromPreferences({ watchlist_seed_symbols: ["spy", " qqq "] })
    ).toEqual(["SPY", "QQQ"]);
  });

  it("resolveWatchlistSeedSymbols hybrid precedence", () => {
    const desk = ["SPY", "QQQ"];
    expect(
      resolveWatchlistSeedSymbols({
        defaultWatchlist: false,
        deskDefaults: desk
      })
    ).toBeUndefined();
    expect(
      resolveWatchlistSeedSymbols({
        defaultWatchlist: true,
        overrideSymbols: ["NVDA"],
        tenantTemplateSymbols: ["IWM"],
        deskDefaults: desk
      })
    ).toEqual(["NVDA"]);
    expect(
      resolveWatchlistSeedSymbols({
        defaultWatchlist: true,
        tenantTemplateSymbols: ["IWM"],
        deskDefaults: desk
      })
    ).toEqual(["IWM"]);
    expect(
      resolveWatchlistSeedSymbols({
        defaultWatchlist: true,
        deskDefaults: desk
      })
    ).toEqual(["SPY", "QQQ"]);
  });
});
