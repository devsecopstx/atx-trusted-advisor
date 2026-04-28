import { canUserLogin, isGlobalAdmin } from "@/modules/identity/authorization";
import type { CoreUserBilling } from "@/modules/identity/types";

export type AppUserBillingAccessState =
  | "pending"
  | "approved_unpaid"
  | "active"
  | "past_due"
  | "canceled"
  | "override_active";

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
  now?: Date;
}): AppUserBillingAccessState {
  if (!canUserLogin(input.roles)) {
    return "pending";
  }
  if (isGlobalAdmin(input.roles)) {
    return "active";
  }

  const nowMs = (input.now ?? new Date()).getTime();
  if (isOverrideCurrentlyActive(input.billing?.override, nowMs)) {
    return "override_active";
  }

  const stripeStatus = normalizeStripeStatus(input.billing?.stripeSubscriptionStatus);
  if (stripeStatus === "trialing" || stripeStatus === "active") {
    return "active";
  }
  if (stripeStatus === "past_due" || stripeStatus === "unpaid") {
    return "past_due";
  }
  if (
    stripeStatus === "canceled" ||
    stripeStatus === "incomplete" ||
    stripeStatus === "incomplete_expired"
  ) {
    return "canceled";
  }
  if (
    stripeStatus === "paused" ||
    (input.billing?.canceledAt instanceof Date && input.billing.canceledAt.getTime() <= nowMs)
  ) {
    return "canceled";
  }
  return "approved_unpaid";
}

/** Stripe-paid or admin override — subscription revenue / “active plan” semantics. */
export function isBillingEntitledAccessState(state: AppUserBillingAccessState): boolean {
  return state === "active" || state === "override_active";
}

/**
 * App surfaces (xChat, xOptions, portfolio APIs behind billing proxy): allow approved users who have
 * not started Stripe yet, until they subscribe — then state moves to `active` and the unpaid banner goes away.
 */
export function isAppUserProductAccessAllowedState(state: AppUserBillingAccessState): boolean {
  return isBillingEntitledAccessState(state) || state === "approved_unpaid";
}

