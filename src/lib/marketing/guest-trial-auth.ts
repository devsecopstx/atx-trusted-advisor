import { isXIdentityPlaceholderEmail } from "@/lib/x-identity-email";
import {
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

/**
 * Open signup: always grant operator + basic + 30d trial before access gates run.
 * Server-only — import from API routes / OAuth callbacks only.
 */
export async function provisionOpenSignupTrialAccess(input: {
  user: CoreUser;
  emailFromProvider?: string;
}): Promise<CoreUser> {
  const hasRealEmail =
    Boolean(input.emailFromProvider?.trim()) && !isXIdentityPlaceholderEmail(input.user.email);
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

/**
 * When the user started from the guest trial CTA, grant operator + basic + 30d trial before access gates run.
 * Prefer {@link provisionOpenSignupTrialAccess} for unconditional open signup.
 * Server-only — import from API routes / OAuth callbacks only.
 */
export async function tryProvisionGuestTrialFromIntent(input: {
  user: CoreUser;
  ctx: GuestTrialAuthContext;
}): Promise<CoreUser> {
  if (!input.ctx.trialIntent) {
    return input.user;
  }
  return provisionOpenSignupTrialAccess({
    user: input.user,
    emailFromProvider: input.ctx.emailFromProvider
  });
}
