import type { CoreUser } from "@/modules/identity/types";

/** Legacy `core_users` without `accountStatus` are treated as approved (pre-gate deployments). */
export function isCoreUserAccountAccessApproved(user: CoreUser): boolean {
  const s = user.accountStatus;
  if (s === undefined || s === null) {
    return true;
  }
  return s === "approved";
}

export function isCoreUserAccountRejected(user: CoreUser): boolean {
  return user.accountStatus === "rejected";
}
