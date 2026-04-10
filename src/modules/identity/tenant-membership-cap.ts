/** Thrown when assigning a user to a tenant would exceed `workspaceLimits.maxUsersPerTenant`. */
export class TenantMembershipCapExceededError extends Error {
  readonly code = "tenant_membership_cap_exceeded" as const;

  constructor(
    public readonly tenantIdHex: string,
    public readonly maxUsers: number,
    public readonly currentCount: number
  ) {
    super(
      `This tenant already has the maximum number of users (${currentCount}/${maxUsers}). Increase the limit in Admin → Tenant workspace limits or remove a membership.`
    );
    this.name = "TenantMembershipCapExceededError";
  }
}

export function isTenantMembershipCapExceededError(e: unknown): e is TenantMembershipCapExceededError {
  return e instanceof TenantMembershipCapExceededError;
}
