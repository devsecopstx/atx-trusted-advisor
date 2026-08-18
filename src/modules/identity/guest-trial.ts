import {
  GUEST_TRIAL_DEFAULT_PLAN,
  GUEST_TRIAL_DEFAULT_ROLE,
  GUEST_TRIAL_DURATION_MS,
  isGuestTrialActive
} from "@/modules/identity/guest-trial-constants";
import { canUserLogin, isGlobalAdmin } from "@/modules/identity/authorization";
import {
  addRoleToCoreUser,
  ensureDefaultTenant,
  updateCoreUserAccountStatus,
  updateCoreUserSubscriptionPlan,
  upsertTenantMembership
} from "@/modules/identity/repository";
import { getDb } from "@/lib/mongodb";
import type { CoreUser } from "@/modules/identity/types";

export * from "@/modules/identity/guest-trial-constants";

const CORE_USERS = "core_users";

export type ProvisionGuestTrialResult =
  | { ok: true; user: CoreUser; newlyProvisioned: boolean }
  | { ok: false; reason: "skip_admin" | "skip_existing" | "missing_user_id" };

/**
 * First sign-in from guest trial CTA: operator + basic plan + 30-day trial window + default tenant membership.
 * Idempotent while trial is active; does not extend expired trials automatically.
 * Server-only — do not import from client components.
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
  // Do not upgrade an existing login-capable or already-approved account.
  if (canUserLogin(user.roles) || user.accountStatus === "approved") {
    return { ok: false, reason: "skip_existing" };
  }

  const userId = user._id;
  const now = new Date();
  let current = user;
  let newlyProvisioned = false;

  if (!isGuestTrialActive(current, now) && !current.trialEndsAt) {
    const trialEndsAt = new Date(now.getTime() + GUEST_TRIAL_DURATION_MS);
    await (await getDb()).collection<CoreUser>(CORE_USERS).updateOne(
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
    await updateCoreUserAccountStatus({ userId, accountStatus: "approved" });
    current = { ...current, accountStatus: "approved" };
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
    await (await getDb()).collection<CoreUser>(CORE_USERS).updateOne(
      { _id: userId },
      { $set: { emailVerifiedAt: now, updatedAt: now } }
    );
    current = { ...current, emailVerifiedAt: now };
  }

  return { ok: true, user: current, newlyProvisioned };
}
