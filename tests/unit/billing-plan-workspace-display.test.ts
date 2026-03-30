import { ObjectId } from "mongodb";
import { describe, expect, it } from "vitest";

import { ATX_BILLING_PLANS } from "@/lib/atx-billing-plans";
import {
    billingCardPriceParts,
    billingCardWorkspaceDisplay,
    formatWorkspaceLimitScalar
} from "@/lib/billing-plan-workspace-display";
import type { Tenant } from "@/modules/identity/types";

function mockTenant(partial: Pick<Tenant, "workspaceLimits"> & Partial<Tenant>): Tenant {
  return {
    _id: new ObjectId(),
    slug: "test-tenant",
    name: "Test tenant",
    isDefault: true,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...partial
  };
}

describe("billingCardWorkspaceDisplay", () => {
  const basicPlan = ATX_BILLING_PLANS[0];
  const premiumPlan = ATX_BILLING_PLANS[1];

  it("guest uses catalog four rows and default list price", () => {
    const d = billingCardWorkspaceDisplay({ tenant: null, plan: basicPlan });
    expect(d.priceParts).toEqual({ priceAmount: "$9", periodNote: "per month" });
    expect(d.limitRows).toHaveLength(4);
    expect(d.limitRows[0]?.label).toBe("xOptions views / hr");
    expect(d.limitRows[0]?.value).toBe("10");
    expect(d.limitRows[1]?.label).toBe("xChat prompts / hr");
    expect(d.limitRows[1]?.value).toBe("1");
  });

  it("guest premium column uses catalog premium cells", () => {
    const d = billingCardWorkspaceDisplay({ tenant: null, plan: premiumPlan });
    expect(d.priceParts.priceAmount).toBe("$99");
    expect(d.limitRows[0]?.value).toContain("Unlimited");
  });

  it("tenant applies admin price override for tier", () => {
    const tenant = mockTenant({
      workspaceLimits: {
        planOverrides: {
          basic: { price: 12 }
        }
      }
    });
    const d = billingCardWorkspaceDisplay({ tenant, plan: basicPlan });
    expect(d.priceParts).toEqual({ priceAmount: "$12", periodNote: "per month" });
  });

  it("tenant resolves numeric limits from merged base + plan row", () => {
    const tenant = mockTenant({
      workspaceLimits: {
        userChatLimit: 20,
        planOverrides: {
          basic: { userChatLimit: 5, userXoptionsLimit: 7 }
        }
      }
    });
    const d = billingCardWorkspaceDisplay({ tenant, plan: basicPlan });
    const chat = d.limitRows.find((r) => r.label === "xChat prompts / hr");
    const xopt = d.limitRows.find((r) => r.label === "xOptions views / hr");
    expect(xopt?.value).toBe("7");
    expect(chat?.value).toBe("5");
  });

  it("normalizes legacy premium_plus_yearly planOverrides for Premium+ card", () => {
    const plusPlan = ATX_BILLING_PLANS[2];
    const tenant = mockTenant({
      workspaceLimits: {
        planOverrides: {
          premium_plus_yearly: { price: 350, userChatLimit: 99 }
        }
      } as Tenant["workspaceLimits"]
    });
    const d = billingCardWorkspaceDisplay({ tenant, plan: plusPlan });
    expect(d.priceParts).toEqual({ priceAmount: "$350", periodNote: "per month" });
    const chat = d.limitRows.find((r) => r.label === "xChat prompts / hr");
    expect(chat?.value).toBe("99");
  });
});

describe("billingCardPriceParts", () => {
  it("uses catalog when override row missing or has no price", () => {
    const basicPlan = ATX_BILLING_PLANS[0];
    expect(billingCardPriceParts(basicPlan, undefined)).toEqual({
      priceAmount: "$9",
      periodNote: "per month"
    });
    expect(billingCardPriceParts(basicPlan, {})).toEqual({
      priceAmount: "$9",
      periodNote: "per month"
    });
  });
});

describe("formatWorkspaceLimitScalar", () => {
  it("formats large caps as Unlimited", () => {
    expect(formatWorkspaceLimitScalar(100_000)).toBe("Unlimited");
    expect(formatWorkspaceLimitScalar(42)).toBe("42");
  });
});
