import { ObjectId } from "mongodb";

export type CoreUserRole = "global_admin" | "advisor" | "operator" | "viewer";
export type SubscriptionPlan = "free" | "pro" | "enterprise";

export type CoreUser = {
  _id?: ObjectId;
  email: string;
  roles: CoreUserRole[];
  subscriptionPlan?: SubscriptionPlan;
  status: "active" | "suspended";
  xAccount?: {
    xUserId: string;
    username: string;
    displayName?: string;
    avatarUrl?: string;
    linkedAt: Date;
  };
  createdAt: Date;
  updatedAt: Date;
  lastLoginAt?: Date;
};

export type Tenant = {
  _id?: ObjectId;
  slug: string;
  name: string;
  isDefault: boolean;
  createdAt: Date;
  updatedAt: Date;
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
