import { describe, expect, it } from "vitest";

import {
    effectiveWorkspaceLimitsForTenantAndPlan,
    tenantBaseWorkspaceLimits
} from "@/lib/tenant-workspace-limits";
import {
    coalesceTenantWorkspaceLimitsForPersistence,
    DEFAULT_TENANT_WORKSPACE_LIMITS,
    tenantWorkspaceLimitsScalarsMissing
} from "@/modules/identity/tenant-workspace-limits";
import type { Tenant } from "@/modules/identity/types";

describe("lib/tenant-workspace-limits", () => {
  it("tenantBaseWorkspaceLimits ignores planOverrides for userChatLimit", () => {
    const tenant = {
      workspaceLimits: {
        userChatLimit: 100,
        userChatHourlyLimit: 50,
        planOverrides: {
          basic: { userChatLimit: 7, userChatHourlyLimit: 2 }
        }
      }
    } as unknown as Tenant;
    const base = tenantBaseWorkspaceLimits(tenant);
    expect(base.userChatLimit).toBe(100);
    expect(base.userChatHourlyLimit).toBe(50);
  });

  it("effectiveWorkspaceLimitsForTenantAndPlan still merges plan row for other product use", () => {
    const tenant = {
      workspaceLimits: {
        userChatLimit: 100,
        planOverrides: {
          basic: { userChatLimit: 7, tenantPortfolioLimit: 9 }
        }
      }
    } as unknown as Tenant;
    expect(effectiveWorkspaceLimitsForTenantAndPlan(tenant, "basic").userChatLimit).toBe(7);
    expect(effectiveWorkspaceLimitsForTenantAndPlan(tenant, "basic").tenantPortfolioLimit).toBe(9);
  });
});

describe("identity/tenant-workspace-limits persistence helpers", () => {
  it("tenantWorkspaceLimitsScalarsMissing is true for null and planOverrides-only", () => {
    expect(tenantWorkspaceLimitsScalarsMissing(null)).toBe(true);
    expect(tenantWorkspaceLimitsScalarsMissing(undefined)).toBe(true);
    expect(tenantWorkspaceLimitsScalarsMissing({})).toBe(true);
    expect(
      tenantWorkspaceLimitsScalarsMissing({
        planOverrides: { basic: { userChatLimit: 5 } }
      })
    ).toBe(true);
  });

  it("tenantWorkspaceLimitsScalarsMissing is false when a limit scalar is set", () => {
    expect(tenantWorkspaceLimitsScalarsMissing({ userChatLimit: 50 })).toBe(false);
  });

  it("coalesceTenantWorkspaceLimitsForPersistence fills defaults and keeps planOverrides", () => {
    const out = coalesceTenantWorkspaceLimitsForPersistence({
      planOverrides: { basic: { userChatLimit: 7 } }
    });
    expect(out.userChatLimit).toBe(DEFAULT_TENANT_WORKSPACE_LIMITS.userChatLimit);
    expect(out.planOverrides).toEqual({ basic: { userChatLimit: 7 } });
  });
});
