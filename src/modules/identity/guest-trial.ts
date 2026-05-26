import { ObjectId } from "mongodb";

import { isGlobalAdmin } from "@/modules/identity/authorization";
import {
  addRoleToCoreUser,
  ensureDefaultTenant,
  updateCoreUserAccountStatus,
  updateCoreUserSubscriptionPlan,
  upsertTenantMembership
} from "@/modules/identity/repository";
import { getDb } from "@/lib/mongodb";
import type { CoreUser } from "@/modules/identity/types";

const CORE_USERS = "core_users";

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

export function isGuestTrialActive(user: Pick<CoreUser, "trialEndsAt">, now: Date = new Date()): boolean {
  const ends = user.trialEndsAt;
  return ends instanceof Date && ends.getTime() > now.getTime();
}

export function isGuestTrialExpired(user: Pick<CoreUser, "trialEndsAt">, now: Date = new Date()): boolean {
  const ends = user.trialEndsAt;
  return ends instanceof Date && ends.getTime() <= now.getTime();
}

export type ProvisionGuestTrialResult =
  | { ok: true; user: CoreUser; newlyProvisioned: boolean }
  | { ok: false; reason: "skip_admin" | "missing_user_id" };

/**
 * First sign-in from guest trial CTA: operator + basic plan + 30-day trial window + default tenant membership.
 * Idempotent while trial is active; does not extend expired trials automatically.
 */
export async function provisionGuestTrialOperatorAccess(input: {
  user: CoreUser;
  /** When true, mark email verified if still pending (X/Google returned email path). */
  markEmailVerified?: boolean;
}): Promise<ProvisionGuestTrialResult> {
  const user = input.user;
  if (!user._id) {
    return { ok: false, reason: "missing_user_id" };
  }
  if (isGlobalAdmin(user.roles)) {
    return { ok: false, reason: "skip_admin" };
  }

  const userId = user._id;
  const now = new Date();
  let current = user;
  let newlyProvisioned = false;

  if (!isGuestTrialActive(current, now) && !current.trialEndsAt) {
    const trialEndsAt = new Date(now.getTime() + GUEST_TRIAL_DURATION_MS);
    await getDb().collection<CoreUser>(CORE_USERS).updateOne(
      { _id: userId },
      {
        $set: {
          trialEndsAt,
          guestTrialStartedAt: now,
          updatedAt: now
        }
      }
    );
    newlyProvisioned = true;
    current = { ...current, trialEndsAt, guestTrialStartedAt: now };
  }

  if (!current.roles.includes(GUEST_TRIAL_DEFAULT_ROLE)) {
    current = await addRoleToCoreUser({ userId, role: GUEST_TRIAL_DEFAULT_ROLE });
  }

  if (current.accountStatus !== "approved") {
    current = await updateCoreUserAccountStatus({ userId, accountStatus: "approved" });
  }

  const plan = current.subscriptionPlan ?? GUEST_TRIAL_DEFAULT_PLAN;
  if (plan !== GUEST_TRIAL_DEFAULT_PLAN) {
    current = await updateCoreUserSubscriptionPlan({
      userId,
      subscriptionPlan: GUEST_TRIAL_DEFAULT_PLAN
    });
  } else if (!current.subscriptionPlan) {
    current = await updateCoreUserSubscriptionPlan({
      userId,
      subscriptionPlan: GUEST_TRIAL_DEFAULT_PLAN
    });
  }

  const tenant = await ensureDefaultTenant();
  if (tenant._id) {
    await upsertTenantMembership({
      userId,
      tenantId: tenant._id,
      role: "member",
      isDefaultTenant: true
    });
  }

  if (input.markEmailVerified && !(current.emailVerifiedAt instanceof Date)) {
    await getDb().collection<CoreUser>(CORE_USERS).updateOne(
      { _id: userId },
      { $set: { emailVerifiedAt: now, updatedAt: now } }
    );
    current = { ...current, emailVerifiedAt: now };
  }

  return { ok: true, user: current, newlyProvisioned };
}
