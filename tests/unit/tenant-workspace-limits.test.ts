import { describe, expect, it } from "vitest";

import {
    applyTenantPlanRowToBase,
    DEFAULT_TENANT_PLAN_PRICE,
    DEFAULT_TENANT_WORKSPACE_LIMITS,
    mergeTenantWorkspaceLimits,
    normalizePlanOverridesFromUnknown,
    parsePlanOverridesPayload,
    parseWorkspaceLimitsPayload,
    resolvedTenantPlanPrice
} from "@/modules/identity/tenant-workspace-limits";

describe("tenant workspace limits", () => {
  it("mergeTenantWorkspaceLimits uses defaults when partial empty", () => {
    expect(mergeTenantWorkspaceLimits(null)).toEqual(DEFAULT_TENANT_WORKSPACE_LIMITS);
    expect(mergeTenantWorkspaceLimits({})).toEqual(DEFAULT_TENANT_WORKSPACE_LIMITS);
  });

  it("mergeTenantWorkspaceLimits overrides only valid positive ints", () => {
    expect(
      mergeTenantWorkspaceLimits({
        userChatLimit: 25,
        tenantPortfolioLimit: 0,
        portfolioAccountLimit: 2.5 as unknown as number
      })
    ).toEqual({
      ...DEFAULT_TENANT_WORKSPACE_LIMITS,
      userChatLimit: 25
    });
  });

  it("parseWorkspaceLimitsPayload accepts camelCase object", () => {
    const parsed = parseWorkspaceLimitsPayload({
      userXoptionsLimit: 5,
      userChatLimit: 20,
      tenantPortfolioLimit: 3,
      portfolioAccountLimit: 2
    });
    expect(parsed.ok).toBe(true);
    if (parsed.ok) {
      expect(parsed.value).toEqual({
        userXoptionsLimit: 5,
        userChatLimit: 20,
        tenantPortfolioLimit: 3,
        portfolioAccountLimit: 2
      });
    }
  });

  it("parseWorkspaceLimitsPayload rejects invalid values", () => {
    const parsed = parseWorkspaceLimitsPayload({ userChatLimit: 0 });
    expect(parsed.ok).toBe(false);
  });

  it("parsePlanOverridesPayload accepts partial rows per plan", () => {
    const parsed = parsePlanOverridesPayload({
      basic: { userChatLimit: 2 },
      premium_monthly: { tenantPortfolioLimit: 4 }
    });
    expect(parsed.ok).toBe(true);
    if (parsed.ok) {
      expect(parsed.value).toEqual({
        basic: { userChatLimit: 2 },
        premium_monthly: { tenantPortfolioLimit: 4 }
      });
    }
  });

  it("parsePlanOverridesPayload rejects unknown plan keys", () => {
    const parsed = parsePlanOverridesPayload({ enterprise: { userChatLimit: 1 } });
    expect(parsed.ok).toBe(false);
  });

  it("applyTenantPlanRowToBase merges only overridden scalars", () => {
    const base = { ...DEFAULT_TENANT_WORKSPACE_LIMITS, userChatLimit: 20 };
    const merged = applyTenantPlanRowToBase(
      base,
      { basic: { userChatLimit: 5 } },
      "basic"
    );
    expect(merged.userChatLimit).toBe(5);
    expect(merged.userXoptionsLimit).toBe(base.userXoptionsLimit);
  });

  it("applyTenantPlanRowToBase ignores price on the row", () => {
    const base = DEFAULT_TENANT_WORKSPACE_LIMITS;
    const merged = applyTenantPlanRowToBase(
      base,
      { basic: { userChatLimit: 5, price: 99 } },
      "basic"
    );
    expect(merged.userChatLimit).toBe(5);
    expect((merged as { price?: number }).price).toBeUndefined();
  });

  it("parsePlanOverridesPayload accepts price per plan", () => {
    const parsed = parsePlanOverridesPayload({
      basic: { price: DEFAULT_TENANT_PLAN_PRICE },
      premium_monthly: { userChatLimit: 3, price: 99 }
    });
    expect(parsed.ok).toBe(true);
    if (parsed.ok) {
      expect(parsed.value.basic?.price).toBe(DEFAULT_TENANT_PLAN_PRICE);
      expect(parsed.value.premium_monthly).toEqual({ userChatLimit: 3, price: 99 });
    }
  });

  it("parsePlanOverridesPayload rejects invalid price", () => {
    const parsed = parsePlanOverridesPayload({ basic: { price: 0 } });
    expect(parsed.ok).toBe(false);
  });

  it("resolvedTenantPlanPrice defaults when missing or invalid", () => {
    expect(resolvedTenantPlanPrice(undefined)).toBe(DEFAULT_TENANT_PLAN_PRICE);
    expect(resolvedTenantPlanPrice({ price: 25 })).toBe(25);
    expect(resolvedTenantPlanPrice({ userChatLimit: 3 })).toBe(DEFAULT_TENANT_PLAN_PRICE);
  });

  it("normalizePlanOverridesFromUnknown drops invalid nested rows", () => {
    expect(
      normalizePlanOverridesFromUnknown({
        basic: "bad",
        premium_monthly: { userChatLimit: 7 }
      })
    ).toEqual({ premium_monthly: { userChatLimit: 7 } });
  });

  it("normalizePlanOverridesFromUnknown reads price when valid", () => {
    expect(
      normalizePlanOverridesFromUnknown({
        basic: { price: 42, userChatLimit: 2 }
      })
    ).toEqual({ basic: { userChatLimit: 2, price: 42 } });
  });

  it("normalizePlanOverridesFromUnknown maps legacy premium_plus_yearly to premium_plus_monthly", () => {
    expect(
      normalizePlanOverridesFromUnknown({
        premium_plus_yearly: { userChatLimit: 9 }
      })
    ).toEqual({ premium_plus_monthly: { userChatLimit: 9 } });
  });

  it("parsePlanOverridesPayload maps legacy premium_plus_yearly to premium_plus_monthly", () => {
    const parsed = parsePlanOverridesPayload({
      premium_plus_yearly: { userChatLimit: 3 }
    });
    expect(parsed.ok).toBe(true);
    if (parsed.ok) {
      expect(parsed.value.premium_plus_monthly?.userChatLimit).toBe(3);
    }
  });

  it("parsePlanOverridesPayload merges legacy then canonical when both present for Premium+", () => {
    const parsed = parsePlanOverridesPayload({
      premium_plus_yearly: { userChatLimit: 1 },
      premium_plus_monthly: { userChatLimit: 5 }
    });
    expect(parsed.ok).toBe(true);
    if (parsed.ok) {
      expect(parsed.value.premium_plus_monthly?.userChatLimit).toBe(5);
    }
  });
});
