import { ObjectId } from "mongodb";
import type Stripe from "stripe";
import { beforeEach, describe, expect, it, vi } from "vitest";

const stripeConfigMocks = vi.hoisted(() => ({
  getRentalAiStripeBasePriceId: vi.fn()
}));

const mongoMocks = vi.hoisted(() => ({
  getDb: vi.fn()
}));

vi.mock("@/lib/stripe-config", () => stripeConfigMocks);

vi.mock("@/lib/mongodb", () => mongoMocks);

import { getDb } from "@/lib/mongodb";
import {
    subscriptionIncludesRentalBasePrice,
    syncCoreTenantRentalFromStripeSubscription
} from "@/modules/platform/rental-ai-stripe-sync";

function mockSubscription(partial: {
  id: string;
  status: Stripe.Subscription.Status;
  priceId: string;
  metadata?: Stripe.Metadata;
  current_period_end?: number;
}): Stripe.Subscription {
  return {
    id: partial.id,
    object: "subscription",
    status: partial.status,
    metadata: partial.metadata ?? {},
    items: {
      object: "list",
      data: [
        {
          id: "si_1",
          object: "subscription_item",
          price: { id: partial.priceId, object: "price" }
        }
      ],
      has_more: false,
      url: ""
    },
    current_period_end: partial.current_period_end ?? Math.floor(Date.now() / 1000) + 86_400
  } as Stripe.Subscription;
}

describe("rental-ai-stripe-sync", () => {
  const tenantHex = "507f1f77bcf86cd799439066";
  const tenantOid = new ObjectId(tenantHex);

  beforeEach(() => {
    vi.clearAllMocks();
    stripeConfigMocks.getRentalAiStripeBasePriceId.mockReturnValue("price_rental_unit");
  });

  it("subscriptionIncludesRentalBasePrice detects configured price", () => {
    const sub = mockSubscription({
      id: "sub_x",
      status: "active",
      priceId: "price_rental_unit"
    });
    expect(subscriptionIncludesRentalBasePrice(sub)).toBe(true);
    stripeConfigMocks.getRentalAiStripeBasePriceId.mockReturnValue(undefined);
    expect(subscriptionIncludesRentalBasePrice(sub)).toBe(false);
  });

  it("syncCoreTenantRentalFromStripeSubscription updates tenant when metadata maps tenant", async () => {
    const updateOne = vi.fn().mockResolvedValue({ matchedCount: 1 });
    const findOne = vi.fn().mockResolvedValue({
      _id: tenantOid,
      rentalProfile: {
        tier: "ria",
        expiresAt: new Date(),
        apiKeyEnabled: true,
        strategyBias: "conservative",
        maxPortfolios: 3,
        maxDailyTokens: 200_000
      }
    });

    mongoMocks.getDb.mockResolvedValue({
      collection: (name: string) => {
        if (name !== "core_tenants") {
          return { findOne: vi.fn(), updateOne: vi.fn() };
        }
        return { findOne, updateOne };
      }
    });

    const sub = mockSubscription({
      id: "sub_rental_1",
      status: "active",
      priceId: "price_rental_unit",
      metadata: { atx_rental_tenant_id: tenantHex }
    });

    const result = await syncCoreTenantRentalFromStripeSubscription(sub);
    expect(result.updated).toBe(true);
    expect(result.tenantIdHex).toBe(tenantHex);
    expect(updateOne).toHaveBeenCalledTimes(1);
    expect(getDb).toHaveBeenCalled();
  });

  it("sync resolves tenant by rentalStripeSubscriptionId when metadata absent", async () => {
    const updateOne = vi.fn().mockResolvedValue({ matchedCount: 1 });
    const findOne = vi.fn().mockImplementation(async (query: Record<string, unknown>) => {
      if (query.rentalStripeSubscriptionId === "sub_lookup") {
        return { _id: tenantOid };
      }
      if (query._id instanceof ObjectId && query._id.equals(tenantOid)) {
        return {
          _id: tenantOid,
          rentalProfile: {
            tier: "ria",
            expiresAt: new Date(),
            apiKeyEnabled: true,
            strategyBias: "conservative",
            maxPortfolios: 3,
            maxDailyTokens: 200_000
          }
        };
      }
      return null;
    });

    mongoMocks.getDb.mockResolvedValue({
      collection: (name: string) => {
        if (name !== "core_tenants") {
          return { findOne: vi.fn(), updateOne: vi.fn() };
        }
        return { findOne, updateOne };
      }
    });

    const sub = mockSubscription({
      id: "sub_lookup",
      status: "active",
      priceId: "price_rental_unit",
      metadata: {}
    });

    const result = await syncCoreTenantRentalFromStripeSubscription(sub);
    expect(result.updated).toBe(true);
  });
});
