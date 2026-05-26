import {
  GUEST_TRIAL_INTENT_QUERY
} from "@/modules/identity/guest-trial-constants";

/** Client-safe OAuth URL for guest trial CTA (no Mongo imports). */
export function buildGuestTrialXOAuthLoginHref(nextPath = "/xchat"): string {
  const params = new URLSearchParams();
  params.set("next", nextPath);
  params.set(GUEST_TRIAL_INTENT_QUERY, "1");
  return `/api/auth/x/login?${params.toString()}`;
}
