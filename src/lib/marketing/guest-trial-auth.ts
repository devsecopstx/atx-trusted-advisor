import {
  GUEST_TRIAL_INTENT_COOKIE,
  GUEST_TRIAL_INTENT_QUERY,
  isGuestTrialIntentCookieValue,
  parseGuestTrialIntentParam,
  provisionGuestTrialOperatorAccess
} from "@/modules/identity/guest-trial";
import { bustBillingAccessDecisionCache } from "@/modules/identity/billing-access-decision-cache";
import type { CoreUser } from "@/modules/identity/types";

export type GuestTrialAuthContext = {
  trialIntent: boolean;
  emailFromProvider?: string;
};

export function resolveGuestTrialAuthContext(input: {
  trialQuery?: string | null;
  trialCookie?: string | undefined;
}): GuestTrialAuthContext {
  return {
    trialIntent:
      parseGuestTrialIntentParam(input.trialQuery) ||
      isGuestTrialIntentCookieValue(input.trialCookie)
  };
}

export function buildGuestTrialXOAuthLoginHref(nextPath = "/xchat"): string {
  const params = new URLSearchParams();
  params.set("next", nextPath);
  params.set(GUEST_TRIAL_INTENT_QUERY, "1");
  return `/api/auth/x/login?${params.toString()}`;
}

/**
 * When the user started from the guest trial CTA, grant operator + basic + 30d trial before access gates run.
 */
export async function tryProvisionGuestTrialFromIntent(input: {
  user: CoreUser;
  ctx: GuestTrialAuthContext;
}): Promise<CoreUser> {
  if (!input.ctx.trialIntent) {
    return input.user;
  }
  const hasRealEmail =
    Boolean(input.ctx.emailFromProvider?.trim()) &&
    !input.user.email.includes("@users.xfinance.local");
  const result = await provisionGuestTrialOperatorAccess({
    user: input.user,
    markEmailVerified: hasRealEmail
  });
  if (result.ok) {
    if (result.user._id) {
      await bustBillingAccessDecisionCache(result.user._id.toHexString());
    }
    return result.user;
  }
  return input.user;
}

export { GUEST_TRIAL_INTENT_COOKIE, GUEST_TRIAL_INTENT_QUERY };
