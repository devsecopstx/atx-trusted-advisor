export type BillingAccessTone = "ok" | "warn" | "bad" | "muted";

export type BillingAccessStateDetailInput = {
  state: string | null;
  /** When `trial_active`, optional whole days left in the guest trial window. */
  trialDaysRemaining?: number | null;
};

export function billingAccessStateDetail(
  stateOrInput: string | null | BillingAccessStateDetailInput
): { tone: BillingAccessTone; detail: string } {
  const state = typeof stateOrInput === "object" && stateOrInput !== null ? stateOrInput.state : stateOrInput;
  const trialDaysRemaining =
    typeof stateOrInput === "object" && stateOrInput !== null
      ? stateOrInput.trialDaysRemaining
      : undefined;

  switch (state) {
    case "active":
      return { tone: "ok", detail: "Subscription is active." };
    case "override_active":
      return { tone: "warn", detail: "Admin billing override is active." };
    case "trial_active": {
      const days =
        typeof trialDaysRemaining === "number" && trialDaysRemaining > 0
          ? ` About ${trialDaysRemaining} day${trialDaysRemaining === 1 ? "" : "s"} left.`
          : "";
      return {
        tone: "warn",
        detail: `You're on a guest trial until billing is completed.${days} Complete billing anytime to keep full access without interruption.`
      };
    }
    case "trial_expired":
      return {
        tone: "warn",
        detail:
          "Your trial window ended — you still have workspace access. Complete billing when you're ready."
      };
    case "approved_unpaid":
      return {
        tone: "warn",
        detail:
          "You're on trial-style access until billing is completed. Add a subscription anytime; this notice goes away once billing is active."
      };
    case "past_due":
      return {
        tone: "warn",
        detail:
          "Subscription is past due — you still have workspace access. Update billing when you're ready."
      };
    case "canceled":
      return {
        tone: "warn",
        detail:
          "Subscription is canceled — you still have workspace access. Restart billing anytime from Account → Billing."
      };
    case "pending":
      return { tone: "muted", detail: "Access is pending approval." };
    default:
      return { tone: "muted", detail: "Billing status is unavailable." };
  }
}
