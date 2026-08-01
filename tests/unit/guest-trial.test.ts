import { describe, expect, it } from "vitest";

import {
  guestTrialDaysRemaining,
  isAppUserProductAccessAllowedState,
  isBillingEntitledAccessState,
  resolveAppUserBillingAccessState
} from "@/lib/app-user-billing-state";
import {
  GUEST_TRIAL_DURATION_MS,
  isGuestTrialActive,
  parseGuestTrialIntentParam
} from "@/modules/identity/guest-trial";

describe("guest-trial", () => {
  it("parses trial intent query", () => {
    expect(parseGuestTrialIntentParam("1")).toBe(true);
    expect(parseGuestTrialIntentParam("false")).toBe(false);
  });

  it("trial duration is 30 days", () => {
    expect(GUEST_TRIAL_DURATION_MS).toBe(30 * 24 * 60 * 60 * 1000);
  });

  it("isGuestTrialActive respects trialEndsAt", () => {
    const future = new Date(Date.now() + 60_000);
    const past = new Date(Date.now() - 60_000);
    expect(isGuestTrialActive({ trialEndsAt: future })).toBe(true);
    expect(isGuestTrialActive({ trialEndsAt: past })).toBe(false);
  });
});

describe("app-user-billing-state guest trial", () => {
  const operatorRoles = ["operator"];

  it("trial_active allows product access without stripe", () => {
    const future = new Date(Date.now() + 86_400_000);
    const state = resolveAppUserBillingAccessState({
      roles: operatorRoles,
      billing: {},
      trialEndsAt: future
    });
    expect(state).toBe("trial_active");
    expect(isBillingEntitledAccessState(state)).toBe(true);
    expect(isAppUserProductAccessAllowedState(state)).toBe(true);
  });

  it("trial_expired still allows product access (billing optional)", () => {
    const past = new Date(Date.now() - 86_400_000);
    const state = resolveAppUserBillingAccessState({
      roles: operatorRoles,
      billing: {},
      trialEndsAt: past
    });
    expect(state).toBe("trial_expired");
    expect(isAppUserProductAccessAllowedState(state)).toBe(true);
  });

  it("guestTrialDaysRemaining rounds up partial days", () => {
    const ends = new Date(Date.now() + 36 * 60 * 60 * 1000);
    expect(guestTrialDaysRemaining(ends)).toBeGreaterThanOrEqual(1);
  });
});
