import { ObjectId } from "mongodb";
import { beforeEach, describe, expect, it, vi } from "vitest";

const provisionMocks = vi.hoisted(() => ({
  provisionGuestTrialOperatorAccess: vi.fn(),
  bustBillingAccessDecisionCache: vi.fn()
}));

vi.mock("@/modules/identity/guest-trial", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/modules/identity/guest-trial")>();
  return {
    ...actual,
    provisionGuestTrialOperatorAccess: provisionMocks.provisionGuestTrialOperatorAccess
  };
});

vi.mock("@/modules/identity/billing-access-decision-cache", () => ({
  bustBillingAccessDecisionCache: provisionMocks.bustBillingAccessDecisionCache
}));

import {
  provisionOpenSignupTrialAccess,
  tryProvisionGuestTrialFromIntent
} from "@/lib/marketing/guest-trial-auth";
import type { CoreUser } from "@/modules/identity/types";

function baseUser(overrides: Partial<CoreUser> = {}): CoreUser {
  return {
    _id: new ObjectId("507f1f77bcf86cd799439011"),
    email: "trial@example.com",
    roles: [],
    status: "active",
    accountStatus: "pending_approval",
    subscriptionPlan: "basic",
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides
  };
}

describe("provisionOpenSignupTrialAccess", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("always calls provisionGuestTrialOperatorAccess without trial cookie", async () => {
    const user = baseUser();
    const provisioned = { ...user, roles: ["operator"], accountStatus: "approved" as const };
    provisionMocks.provisionGuestTrialOperatorAccess.mockResolvedValueOnce({
      ok: true,
      user: provisioned,
      newlyProvisioned: true
    });
    provisionMocks.bustBillingAccessDecisionCache.mockResolvedValueOnce(undefined);

    const result = await provisionOpenSignupTrialAccess({
      user,
      emailFromProvider: "trial@example.com"
    });

    expect(provisionMocks.provisionGuestTrialOperatorAccess).toHaveBeenCalledWith({
      user,
      markEmailVerified: true
    });
    expect(provisionMocks.bustBillingAccessDecisionCache).toHaveBeenCalledWith(
      "507f1f77bcf86cd799439011"
    );
    expect(result.roles).toContain("operator");
  });

  it("tryProvisionGuestTrialFromIntent skips when no intent", async () => {
    const user = baseUser();
    const result = await tryProvisionGuestTrialFromIntent({
      user,
      ctx: { trialIntent: false }
    });
    expect(result).toBe(user);
    expect(provisionMocks.provisionGuestTrialOperatorAccess).not.toHaveBeenCalled();
  });
});
