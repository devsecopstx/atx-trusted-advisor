import { ObjectId } from "mongodb";

import type { SubscriptionPlan } from "@/lib/subscription-plan";
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
  /** Observed on last successful OAuth / link-email completion (admin visibility). */
  lastLoginIp?: string;
  /** e.g. CF-IPCountry when present. */
  lastLoginCountry?: string;
  lastLoginUserAgent?: string;
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
   * xOptions/xChat caps are presented **per hour** on `/account/billing` and admin workspace UI (see `tenant-workspace-limits.ts` field comments for enforcement notes).
   * Optional `planOverrides` — per retail tier (basic / premium_monthly / premium_plus_monthly): quota partials plus optional `price` (USD list price for admin).
   */
  workspaceLimits?: (Partial<TenantWorkspaceLimits> & { planOverrides?: TenantPlanWorkspaceOverrides }) | null;
  /** Branding (one-time) + optional flags (e.g. xchat_debug_enabled). */
  tenantPreferences?: TenantPreferences | null;
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
