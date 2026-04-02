import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
    getStripePriceIdForPlan,
    resolveStripePriceIdForCheckout
} from "@/lib/stripe-config";
import type { TenantPlanWorkspaceOverrides } from "@/modules/identity/tenant-workspace-limits";

describe("resolveStripePriceIdForCheckout", () => {
  const prev = { ...process.env };

  beforeEach(() => {
    process.env.STRIPE_PRICE_BASIC_MONTHLY = "price_env_basic";
    process.env.STRIPE_PRICE_PREMIUM_MONTHLY = "price_env_premium";
    process.env.STRIPE_PRICE_PREMIUM_PLUS_MONTHLY = "price_env_pp";
  });

  afterEach(() => {
    process.env = { ...prev };
  });

  it("prefers tenant stripePriceId over env for basic", () => {
    const overrides: TenantPlanWorkspaceOverrides = {
      basic: { stripePriceId: "price_tenant_basic" }
    };
    expect(resolveStripePriceIdForCheckout("basic", overrides)).toBe("price_tenant_basic");
  });

  it("falls back to env when tenant stripePriceId missing", () => {
    expect(resolveStripePriceIdForCheckout("basic", {})).toBe("price_env_basic");
  });

  it("ignores malformed tenant stripePriceId", () => {
    const overrides: TenantPlanWorkspaceOverrides = {
      basic: { stripePriceId: "not_a_price_id" }
    };
    expect(resolveStripePriceIdForCheckout("basic", overrides)).toBe("price_env_basic");
  });
});

describe("getStripePriceIdForPlan premium_plus fallback", () => {
  const prev = { ...process.env };

  afterEach(() => {
    process.env = { ...prev };
  });

  it("uses STRIPE_PRICE_PREMIUM_PLUS_YEARLY when monthly unset", () => {
    delete process.env.STRIPE_PRICE_PREMIUM_PLUS_MONTHLY;
    process.env.STRIPE_PRICE_PREMIUM_PLUS_YEARLY = "price_yearly_legacy";
    expect(getStripePriceIdForPlan("premium_plus_monthly")).toBe("price_yearly_legacy");
  });
});
