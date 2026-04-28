import { describe, expect, it } from "vitest";

import {
    isAppUserProductAccessAllowedState,
    isBillingEntitledAccessState,
    resolveAppUserBillingAccessState
} from "@/lib/app-user-billing-state";

describe("app-user billing access state", () => {
  it("returns pending when login role is not approved", () => {
    const state = resolveAppUserBillingAccessState({
      roles: [],
      billing: undefined
    });
    expect(state).toBe("pending");
    expect(isBillingEntitledAccessState(state)).toBe(false);
  });

  it("returns approved_unpaid when approved but no stripe status", () => {
    const state = resolveAppUserBillingAccessState({
      roles: ["viewer"],
      billing: undefined
    });
    expect(state).toBe("approved_unpaid");
    expect(isBillingEntitledAccessState(state)).toBe(false);
    expect(isAppUserProductAccessAllowedState(state)).toBe(true);
  });

  it("returns active for active subscription status", () => {
    const state = resolveAppUserBillingAccessState({
      roles: ["advisor"],
      billing: {
        stripeSubscriptionStatus: "active"
      }
    });
    expect(state).toBe("active");
    expect(isBillingEntitledAccessState(state)).toBe(true);
    expect(isAppUserProductAccessAllowedState(state)).toBe(true);
  });

  it("returns past_due for past due status", () => {
    const state = resolveAppUserBillingAccessState({
      roles: ["operator"],
      billing: {
        stripeSubscriptionStatus: "past_due"
      }
    });
    expect(state).toBe("past_due");
    expect(isBillingEntitledAccessState(state)).toBe(false);
    expect(isAppUserProductAccessAllowedState(state)).toBe(false);
  });

  it("returns canceled for canceled status", () => {
    const state = resolveAppUserBillingAccessState({
      roles: ["operator"],
      billing: {
        stripeSubscriptionStatus: "canceled"
      }
    });
    expect(state).toBe("canceled");
    expect(isBillingEntitledAccessState(state)).toBe(false);
  });

  it("returns override_active while override is enabled and unexpired", () => {
    const now = new Date("2026-01-01T00:00:00.000Z");
    const state = resolveAppUserBillingAccessState({
      roles: ["viewer"],
      billing: {
        stripeSubscriptionStatus: "canceled",
        override: {
          enabled: true,
          expiresAt: new Date("2026-01-02T00:00:00.000Z")
        }
      },
      now
    });
    expect(state).toBe("override_active");
    expect(isBillingEntitledAccessState(state)).toBe(true);
  });

  it("returns canceled after override expiry", () => {
    const now = new Date("2026-01-03T00:00:00.000Z");
    const state = resolveAppUserBillingAccessState({
      roles: ["viewer"],
      billing: {
        stripeSubscriptionStatus: "canceled",
        override: {
          enabled: true,
          expiresAt: new Date("2026-01-02T00:00:00.000Z")
        }
      },
      now
    });
    expect(state).toBe("canceled");
    expect(isBillingEntitledAccessState(state)).toBe(false);
  });
});

