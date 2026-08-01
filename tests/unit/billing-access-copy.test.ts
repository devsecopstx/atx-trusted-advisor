import { describe, expect, it } from "vitest";

import { billingAccessStateDetail } from "@/lib/billing-access-copy";

describe("billingAccessStateDetail", () => {
  it("describes trial_active with optional days remaining", () => {
    const withDays = billingAccessStateDetail({ state: "trial_active", trialDaysRemaining: 12 });
    expect(withDays.tone).toBe("warn");
    expect(withDays.detail).toMatch(/guest trial/i);
    expect(withDays.detail).toMatch(/12 days/);

    const withoutDays = billingAccessStateDetail("trial_active");
    expect(withoutDays.detail).toMatch(/guest trial/i);
    expect(withoutDays.detail).not.toMatch(/\d+ day/);
  });

  it("describes trial_expired and approved_unpaid as access-until-billing", () => {
    expect(billingAccessStateDetail("trial_expired").detail).toMatch(/billing/i);
    expect(billingAccessStateDetail("approved_unpaid").detail).toMatch(/billing is completed/i);
  });
});
