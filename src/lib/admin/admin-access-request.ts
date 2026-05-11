export type AdminAccessRequestStatus =
  | "new"
  | "triaged"
  | "pending"
  | "approved"
  | "rejected"
  | "expired";

export type AdminAccessRequestUser = {
  userId: string;
  email?: string;
  xUserId?: string;
  username?: string;
  displayName?: string;
  avatarUrl?: string;
  lastLoginAt?: string;
  lastLoginIp?: string;
  lastLoginCountry?: string;
  lastLoginUserAgent?: string;
};

export type AdminAccessRequest = {
  _id?: string;
  tenantId?: string;
  userId: string;
  requestedRole: "global_admin" | "advisor" | "operator" | "viewer";
  requestedPlan: string;
  reason: string;
  status: AdminAccessRequestStatus;
  requestedAt: string;
  triagedAt?: string;
  triagedBy?: string;
  reviewedBy?: string;
  reviewedAt?: string;
  reviewNote?: string;
  expiredAt?: string;
  policyViolations?: Array<{ code: string; message: string }>;
  user?: AdminAccessRequestUser;
  reviewedByUser?: AdminAccessRequestUser;
  latestAuditEvent?: {
    action: string;
    createdAt: string;
    actor: { userId: string; email?: string; username?: string };
  } | null;
};

export const ADMIN_ACCESS_REQUEST_TERMINAL_STATUSES: AdminAccessRequestStatus[] = [
  "approved",
  "rejected",
  "expired"
];

export function isAdminAccessRequestActionable(status: AdminAccessRequestStatus): boolean {
  return !ADMIN_ACCESS_REQUEST_TERMINAL_STATUSES.includes(status);
}
