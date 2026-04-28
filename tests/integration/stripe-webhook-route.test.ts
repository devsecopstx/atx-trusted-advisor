import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const identityMocks = vi.hoisted(() => ({
  updateCoreUserStripeBilling: vi.fn()
}));

const stripeMocks = vi.hoisted(() => ({
  constructEvent: vi.fn(),
  retrieveSubscription: vi.fn()
}));

vi.mock("@/modules/identity/repository", () => ({
  updateCoreUserStripeBilling: identityMocks.updateCoreUserStripeBilling
}));

vi.mock("stripe", () => ({
  default: class StripeMock {
    webhooks = {
      constructEvent: stripeMocks.constructEvent
    };
    subscriptions = {
      retrieve: stripeMocks.retrieveSubscription
    };
  }
}));

import { POST as postWebhook } from "@/app/api/webhooks/stripe/route";

describe("POST /api/webhooks/stripe", () => {
  const prevEnv = { ...process.env };

  beforeEach(() => {
    process.env = { ...prevEnv };
    process.env.STRIPE_SECRET_KEY = "sk_test_dummy";
    process.env.STRIPE_WEBHOOK_SECRET = "whsec_dummy";
    process.env.STRIPE_PRICE_BASIC_MONTHLY = "price_basic";
    process.env.STRIPE_PRICE_PREMIUM_MONTHLY = "price_premium";
    process.env.STRIPE_PRICE_PREMIUM_PLUS_MONTHLY = "price_premium_plus";
    identityMocks.updateCoreUserStripeBilling.mockReset();
    identityMocks.updateCoreUserStripeBilling.mockResolvedValue({
      _id: { toHexString: () => "507f1f77bcf86cd799439011" }
    });
    stripeMocks.constructEvent.mockReset();
    stripeMocks.retrieveSubscription.mockReset();
  });

  afterEach(() => {
    process.env = { ...prevEnv };
  });

  it("returns 503 when webhook secrets are missing", async () => {
    delete process.env.STRIPE_WEBHOOK_SECRET;
    const res = await postWebhook(
      new Request("http://test/api/webhooks/stripe", {
        method: "POST",
        headers: { "stripe-signature": "sig" },
        body: "{}"
      })
    );
    expect(res.status).toBe(503);
  });

  it("returns 400 for invalid signatures", async () => {
    stripeMocks.constructEvent.mockImplementationOnce(() => {
      throw new Error("bad signature");
    });
    const res = await postWebhook(
      new Request("http://test/api/webhooks/stripe", {
        method: "POST",
        headers: { "stripe-signature": "sig" },
        body: "{}"
      })
    );
    expect(res.status).toBe(400);
  });

  it("updates core user plan on checkout.session.completed", async () => {
    stripeMocks.constructEvent.mockReturnValueOnce({
      id: "evt_1",
      type: "checkout.session.completed",
      data: {
        object: {
          metadata: {
            atx_user_id: "507f1f77bcf86cd799439011",
            atx_plan_id: "premium_monthly"
          },
          client_reference_id: "507f1f77bcf86cd799439011",
          customer: "cus_test_portal_1"
        }
      }
    });
    const res = await postWebhook(
      new Request("http://test/api/webhooks/stripe", {
        method: "POST",
        headers: { "stripe-signature": "sig" },
        body: "{}"
      })
    );
    expect(res.status).toBe(200);
    expect(identityMocks.updateCoreUserStripeBilling).toHaveBeenCalledWith(
      expect.objectContaining({
        subscriptionPlan: "premium",
        stripeCustomerId: "cus_test_portal_1",
        stripeSubscriptionStatus: "active"
      })
    );
  });

  it("downgrades to basic on customer.subscription.deleted", async () => {
    stripeMocks.constructEvent.mockReturnValueOnce({
      id: "evt_2",
      type: "customer.subscription.deleted",
      data: {
        object: {
          metadata: {
            atx_user_id: "507f1f77bcf86cd799439011"
          }
        }
      }
    });
    const res = await postWebhook(
      new Request("http://test/api/webhooks/stripe", {
        method: "POST",
        headers: { "stripe-signature": "sig" },
        body: "{}"
      })
    );
    expect(res.status).toBe(200);
    expect(identityMocks.updateCoreUserStripeBilling).toHaveBeenCalledWith(
      expect.objectContaining({
        subscriptionPlan: "basic",
        stripeSubscriptionStatus: "canceled"
      })
    );
  });
});

