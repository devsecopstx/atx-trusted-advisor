export type BillingAccessTone = "ok" | "warn" | "bad" | "muted";

export function billingAccessStateDetail(state: string | null): { tone: BillingAccessTone; detail: string } {
  switch (state) {
    case "active":
      return { tone: "ok", detail: "Subscription is active." };
    case "override_active":
      return { tone: "warn", detail: "Admin billing override is active." };
    case "approved_unpaid":
      return {
        tone: "warn",
        detail:
          "Approved account — full workspace access until you add a subscription. This notice goes away once billing is active."
      };
    case "past_due":
      return { tone: "bad", detail: "Subscription is past due." };
    case "canceled":
      return { tone: "bad", detail: "Subscription is canceled." };
    case "pending":
      return { tone: "muted", detail: "Access is pending approval." };
    default:
      return { tone: "muted", detail: "Billing status is unavailable." };
  }
}
