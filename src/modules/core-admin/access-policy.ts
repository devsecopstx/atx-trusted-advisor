import type {
    AccessRequest,
    AccessRequestPolicyViolation,
    AccessRequestStatus
} from "@/modules/core-admin/types";
import { ACCESS_REQUEST_SLA_DAYS } from "@/modules/core-admin/types";
import { isGlobalAdmin } from "@/modules/identity/authorization";
import type { SubscriptionPlan } from "@/modules/identity/types";

export type PolicyCheckInput = {
  requestedRole: AccessRequest["requestedRole"];
  requestedPlan: AccessRequest["requestedPlan"];
  currentRoles: string[];
  currentPlan?: SubscriptionPlan;
  tenantId?: string;
};

export function checkAccessRequestPolicy(
  input: PolicyCheckInput
): AccessRequestPolicyViolation[] {
  const violations: AccessRequestPolicyViolation[] = [];

  if (input.currentRoles.includes(input.requestedRole)) {
    violations.push({
      code: "ALREADY_HAS_ROLE",
      message: `User already has the '${input.requestedRole}' role`
    });
  }

  if (isGlobalAdmin(input.currentRoles)) {
    violations.push({
      code: "ADMIN_CANNOT_DOWNGRADE",
      message: "Global admin cannot request a lower role via self-service"
    });
  }

  if (input.requestedRole !== "global_admin") {
    if (input.requestedRole === "advisor" && input.requestedPlan === "free") {
      violations.push({
        code: "ADVISOR_REQUIRES_PAID_PLAN",
        message: "Advisor role requires Pro or Enterprise plan"
      });
    }

    if (
      input.requestedPlan === "enterprise" &&
      input.requestedRole === "viewer"
    ) {
      violations.push({
        code: "ENTERPRISE_REQUIRES_ELEVATED_ROLE",
        message: "Enterprise plan requires advisor or operator role"
      });
    }
  }

  return violations;
}

const VALID_TRANSITIONS: Record<AccessRequestStatus, AccessRequestStatus[]> = {
  new: ["triaged", "approved", "rejected", "expired"],
  triaged: ["pending", "approved", "rejected", "expired"],
  pending: ["approved", "rejected", "expired"],
  approved: [],
  rejected: [],
  expired: []
};

export function canTransition(
  from: AccessRequestStatus,
  to: AccessRequestStatus
): boolean {
  return VALID_TRANSITIONS[from]?.includes(to) ?? false;
}

export function isTerminalStatus(status: AccessRequestStatus): boolean {
  return status === "approved" || status === "rejected" || status === "expired";
}

export function computeExpiry(requestedAt: Date): Date {
  const expiry = new Date(requestedAt);
  expiry.setDate(expiry.getDate() + ACCESS_REQUEST_SLA_DAYS);
  return expiry;
}

export function isExpired(requestedAt: Date, now: Date = new Date()): boolean {
  return now >= computeExpiry(requestedAt);
}
