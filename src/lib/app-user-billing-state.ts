import { canUserLogin, isGlobalAdmin } from "@/modules/identity/authorization";
import { isGuestTrialActive } from "@/modules/identity/guest-trial";
import type { CoreUserBilling } from "@/modules/identity/types";

export type AppUserBillingAccessState =
  | "pending"
  | "approved_unpaid"
  | "active"
  | "past_due"
  | "canceled"
  | "override_active"
  | "trial_active"
  | "trial_expired";

function isOverrideCurrentlyActive(
  override: CoreUserBilling["override"] | undefined,
  nowMs: number
): boolean {
  if (!override?.enabled) {
    return false;
  }
  if (!(override.expiresAt instanceof Date)) {
    return true;
  }
  return override.expiresAt.getTime() > nowMs;
}

function normalizeStripeStatus(status: CoreUserBilling["stripeSubscriptionStatus"]): string | null {
  const normalized = status?.trim().toLowerCase();
  return normalized && normalized.length > 0 ? normalized : null;
}

export function resolveAppUserBillingAccessState(input: {
  roles: string[];
  billing: CoreUserBilling | null | undefined;
  trialEndsAt?: Date | null;
  now?: Date;
}): AppUserBillingAccessState {
  if (!canUserLogin(input.roles)) {
    return "pending";
  }
  if (isGlobalAdmin(input.roles)) {
    return "active";
  }

  const now = input.now ?? new Date();
  const nowMs = now.getTime();
  if (isOverrideCurrentlyActive(input.billing?.override, nowMs)) {
    return "override_active";
  }

  const stripeStatus = normalizeStripeStatus(input.billing?.stripeSubscriptionStatus);
  let base: AppUserBillingAccessState = "approved_unpaid";
  if (stripeStatus === "trialing" || stripeStatus === "active") {
    base = "active";
  } else if (stripeStatus === "past_due" || stripeStatus === "unpaid") {
    base = "past_due";
  } else if (
    stripeStatus === "canceled" ||
    stripeStatus === "incomplete" ||
    stripeStatus === "incomplete_expired"
  ) {
    base = "canceled";
  } else if (
    stripeStatus === "paused" ||
    (input.billing?.canceledAt instanceof Date && input.billing.canceledAt.getTime() <= nowMs)
  ) {
    base = "canceled";
  }

  const ends = input.trialEndsAt;
  if (ends instanceof Date) {
    if (ends.getTime() > now.getTime()) {
      return "trial_active";
    }
    if (base !== "active" && base !== "override_active") {
      return "trial_expired";
    }
  }
  return base;
}

/** Stripe-paid, admin override, or in-app guest trial window. */
export function isBillingEntitledAccessState(state: AppUserBillingAccessState): boolean {
  return state === "active" || state === "override_active" || state === "trial_active";
}

/**
 * App surfaces (xChat, xOptions, portfolio APIs behind billing proxy): allow approved users who have
 * not started Stripe yet, until they subscribe — then state moves to `active` and the unpaid banner goes away.
 */
export function isAppUserProductAccessAllowedState(state: AppUserBillingAccessState): boolean {
  return isBillingEntitledAccessState(state) || state === "approved_unpaid";
}

export function isGuestTrialBillingState(state: AppUserBillingAccessState): boolean {
  return state === "trial_active" || state === "trial_expired";
}

export function guestTrialDaysRemaining(trialEndsAt: Date | undefined, now: Date = new Date()): number {
  if (!isGuestTrialActive({ trialEndsAt }, now)) {
    return 0;
  }
  const ms = trialEndsAt!.getTime() - now.getTime();
  return Math.max(0, Math.ceil(ms / (24 * 60 * 60 * 1000)));
}

