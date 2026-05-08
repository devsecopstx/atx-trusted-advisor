import { ObjectId } from "mongodb";

import type { SubscriptionPlan } from "@/lib/subscription-plan";
import type { XfUiThemePreference } from "@/lib/xf-ui-theme";
import type { PortfolioScoringFactor } from "@/modules/core-admin/scoring-factors";
import type { TenantPreferences } from "@/modules/identity/tenant-branding-preferences";
import type {
    TenantPlanWorkspaceOverrides,
    TenantWorkspaceLimits
} from "@/modules/identity/tenant-workspace-limits";
import type { PlatformRoleForRoutes } from "@/modules/platform/app-user-route-catalog";
import type {
    TenantRentalAiKeyStored,
    TenantRentalProfile
} from "@/modules/platform/tenant-rental-types";
import type { TenantRoleFlags } from "@/modules/platform/tenant-route-policy";

export type CoreUserRole = "global_admin" | "advisor" | "operator" | "viewer";
export type { SubscriptionPlan };

/** Access gate for product sessions — OAuth/public signup rows default to pending until admin approves. Omitted on legacy rows → treated as approved. */
export type CoreUserAccountStatus = "pending_approval" | "approved" | "rejected";

export type CoreUserStripeSubscriptionStatus =
  | "trialing"
  | "active"
  | "past_due"
  | "unpaid"
  | "canceled"
  | "incomplete"
  | "incomplete_expired"
  | "paused";

export type CoreUserBillingOverride = {
  enabled: boolean;
  reason?: string;
  grantedByUserId?: string;
  grantedAt?: Date;
  expiresAt?: Date;
};

export type CoreUserBilling = {
  stripeSubscriptionId?: string;
  stripeSubscriptionStatus?: CoreUserStripeSubscriptionStatus;
  stripeCurrentPeriodEnd?: Date;
  cancelAtPeriodEnd?: boolean;
  canceledAt?: Date;
  override?: CoreUserBillingOverride;
  updatedAt?: Date;
};

export type CoreUserOptionsScanPreferences = {
  frequency: "weekly" | "monthly" | "off";
  deliveryChannel: "inapp" | "email";
  lastRunAt?: Date;
};

export type CoreUser = {
  _id?: ObjectId;
  email: string;
  roles: CoreUserRole[];
  subscriptionPlan?: SubscriptionPlan;
  /** Set when the user completes Stripe Checkout (webhook); used for Billing Portal deep link. */
  stripeCustomerId?: string;
  /** Billing state machine backing data (Stripe status + explicit admin override). */
  billing?: CoreUserBilling;
  xaiCollectionId?: string;
  xaiCollectionName?: string;
  status: "active" | "suspended";
  /** Product access approval (distinct from {@link status} suspension). */
  accountStatus?: CoreUserAccountStatus;
  xAccount?: {
    xUserId: string;
    username: string;
    displayName?: string;
    avatarUrl?: string;
    linkedAt: Date;
  };
  /** Google Sign-In — kept separate from {@link xAccount} so X + Google can attach to one user. */
  googleAccount?: {
    sub: string;
    username: string;
    displayName?: string;
    avatarUrl?: string;
    linkedAt: Date;
  };
  createdAt: Date;
  updatedAt: Date;
  lastLoginAt?: Date;
  /**
   * Scrypt password hash (`hashPassword` in `password-crypto.ts`).
   * OAuth-only users omit this until they complete email invite or set password.
   */
  passwordHash?: string;
  /** Set when the user completes an approval invite or password reset (credentials path). */
  credentialsVerifiedAt?: Date;
  /** Set when email ownership has been verified via `/api/auth/email/verify`. */
  emailVerifiedAt?: Date;
  /** SHA-256 hex of one-time post-approval setup token (see `hashAuthLookupToken`). */
  credentialInviteTokenHash?: string;
  credentialInviteExpiresAt?: Date;
  /** SHA-256 hex of password-reset token. */
  passwordResetTokenHash?: string;
  passwordResetExpiresAt?: Date;
  /** SHA-256 hex of verify-email token for credentials login. */
  emailVerificationTokenHash?: string;
  emailVerificationExpiresAt?: Date;
  /** Observed on last successful OAuth / link-email completion (admin visibility). */
  lastLoginIp?: string;
  /** e.g. CF-IPCountry when present. */
  lastLoginCountry?: string;
  lastLoginUserAgent?: string;
  /**
   * Shell density preference (`light` → soft, `dark` → deep, `system` → OS).
   * Synced from the theme picker; wins over tenant default on sign-in.
   */
  xfUiTheme?: XfUiThemePreference;
  /** Cadence + delivery config for options action scans (scheduled nudges). */
  optionsScanPreferences?: CoreUserOptionsScanPreferences;
};

export type Tenant = {
  _id?: ObjectId;
  slug: string;
  name: string;
  isDefault: boolean;
  createdAt: Date;
  updatedAt: Date;
  /**
   * Optional per-tenant quotas; omitted keys use product defaults (see `mergeTenantWorkspaceLimits`).
   * xChat ask caps: top-level `userChatLimit` / `userChatHourlyLimit` only (`POST /api/xchat/ask`); `planOverrides.*.userChatLimit` does **not** change ask enforcement.
   * App_user task cap: top-level `userTasksMax` only (`POST /api/tasks`).
   * Optional `planOverrides` — per retail tier: portfolio/xOptions/persona/history partials plus optional `price` (USD list price for admin).
   */
  workspaceLimits?: (Partial<TenantWorkspaceLimits> & { planOverrides?: TenantPlanWorkspaceOverrides }) | null;
  /** Branding (one-time) + optional flags (e.g. xchat_debug_enabled). */
  tenantPreferences?: TenantPreferences | null;
  /** Tenant UX v2 role matrix overrides (route allowlists + default landing + capability flags). */
  tenantRoles?: Partial<
    Record<
      PlatformRoleForRoutes,
      {
        allowedRoutes: string[];
        defaultLanding: string;
        flags?: Partial<TenantRoleFlags>;
      }
    >
  > | null;
  /**
   * Optional default weights for new books (`tenant_portfolio`) when the portfolio row has no `scoringFactors`.
   * Same shape as portfolio `scoringFactors`; validated in `scoring-factors.ts`.
   */
  defaultPortfolioScoringFactors?: PortfolioScoringFactor[] | null;
  /** AI rental / white-label API — optional tier profile + API keys (see `atx-docs/sre-ops/rental-ai-platform.md`). */
  rentalProfile?: TenantRentalProfile | null;
  /** Mirror of `rentalProfile.expiresAt` for sparse indexing and suspension jobs (set by provisioning). */
  rentalExpiresAt?: Date | null;
  /** Hashed rental integration keys; plaintext shown once at issuance (admin path — future). */
  apiKeys?: TenantRentalAiKeyStored[] | null;
};

export type TenantRole = "tenant_admin" | "member";

export type TenantMembership = {
  _id?: ObjectId;
  userId: ObjectId;
  tenantId: ObjectId;
  role: TenantRole;
  isDefaultTenant: boolean;
  createdAt: Date;
  updatedAt: Date;
};

export type AuthContext = {
  userId: ObjectId;
  email: string;
  roles: CoreUserRole[];
  tenantId: ObjectId;
  tenantRole: TenantRole;
  xUserId?: string;
  username?: string;
  displayName?: string;
  avatarUrl?: string;
};
