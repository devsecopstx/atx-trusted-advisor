import type { CoreUser } from "@/modules/identity/types";

/** Cookie / query flag: user started OAuth from guest trial CTA. */
export const GUEST_TRIAL_INTENT_COOKIE = "xf_guest_trial_intent";
export const GUEST_TRIAL_INTENT_QUERY = "trial";

/** Default guest blast: basic tier + operator platform role. */
export const GUEST_TRIAL_DEFAULT_ROLE = "operator" as const;
export const GUEST_TRIAL_DEFAULT_PLAN = "basic" as const;

export const GUEST_TRIAL_DURATION_MS = 30 * 24 * 60 * 60 * 1000;

export function parseGuestTrialIntentParam(raw: string | null | undefined): boolean {
  if (!raw) {
    return false;
  }
  const n = raw.trim().toLowerCase();
  return n === "1" || n === "true" || n === "yes";
}

export function isGuestTrialIntentCookieValue(raw: string | undefined): boolean {
  return parseGuestTrialIntentParam(raw);
}

/** Read trial intent from a raw `Cookie` header (Route Handler `request` — no `cookies()` needed). */
export function readGuestTrialIntentFromCookieHeader(
  cookieHeader: string | null | undefined
): string | undefined {
  if (!cookieHeader?.trim()) {
    return undefined;
  }
  for (const part of cookieHeader.split(";")) {
    const eq = part.indexOf("=");
    if (eq < 0) {
      continue;
    }
    const name = part.slice(0, eq).trim();
    if (name !== GUEST_TRIAL_INTENT_COOKIE) {
      continue;
    }
    const raw = part.slice(eq + 1).trim();
    try {
      return decodeURIComponent(raw);
    } catch {
      return raw;
    }
  }
  return undefined;
}

export function readGuestTrialIntentFromRequest(request: Request): string | undefined {
  return readGuestTrialIntentFromCookieHeader(request.headers.get("cookie"));
}

export function isGuestTrialActive(user: Pick<CoreUser, "trialEndsAt">, now: Date = new Date()): boolean {
  const ends = user.trialEndsAt;
  return ends instanceof Date && ends.getTime() > now.getTime();
}

export function isGuestTrialExpired(user: Pick<CoreUser, "trialEndsAt">, now: Date = new Date()): boolean {
  const ends = user.trialEndsAt;
  return ends instanceof Date && ends.getTime() <= now.getTime();
}
