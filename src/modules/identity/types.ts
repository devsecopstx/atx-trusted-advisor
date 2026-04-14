import { ObjectId } from "mongodb";

import type { SubscriptionPlan } from "@/lib/subscription-plan";
import type { XfUiThemePreference } from "@/lib/xf-ui-theme";
import type { PortfolioScoringFactor } from "@/modules/core-admin/scoring-factors";
import type { TenantPreferences } from "@/modules/identity/tenant-branding-preferences";
import type {
    TenantPlanWorkspaceOverrides,
    TenantWorkspaceLimits
} from "@/modules/identity/tenant-workspace-limits";

export type CoreUserRole = "global_admin" | "advisor" | "operator" | "viewer";
export type { SubscriptionPlan };

export type CoreUser = {
  _id?: ObjectId;
  email: string;
  roles: CoreUserRole[];
  subscriptionPlan?: SubscriptionPlan;
  /** Set when the user completes Stripe Checkout (webhook); used for Billing Portal deep link. */
  stripeCustomerId?: string;
  xaiCollectionId?: string;
  xaiCollectionName?: string;
  status: "active" | "suspended";
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
  /** SHA-256 hex of one-time post-approval setup token (see `hashAuthLookupToken`). */
  credentialInviteTokenHash?: string;
  credentialInviteExpiresAt?: Date;
  /** SHA-256 hex of password-reset token. */
  passwordResetTokenHash?: string;
  passwordResetExpiresAt?: Date;
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
   * Optional `planOverrides` — per retail tier: portfolio/xOptions/persona/history partials plus optional `price` (USD list price for admin).
   */
  workspaceLimits?: (Partial<TenantWorkspaceLimits> & { planOverrides?: TenantPlanWorkspaceOverrides }) | null;
  /** Branding (one-time) + optional flags (e.g. xchat_debug_enabled). */
  tenantPreferences?: TenantPreferences | null;
  /**
   * Optional default weights for new books (`tenant_portfolio`) when the portfolio row has no `scoringFactors`.
   * Same shape as portfolio `scoringFactors`; validated in `scoring-factors.ts`.
   */
  defaultPortfolioScoringFactors?: PortfolioScoringFactor[] | null;
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
