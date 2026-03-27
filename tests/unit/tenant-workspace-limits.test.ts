import { describe, expect, it } from "vitest";

import {
  DEFAULT_TENANT_WORKSPACE_LIMITS,
  mergeTenantWorkspaceLimits,
  parseWorkspaceLimitsPayload
} from "@/modules/identity/tenant-workspace-limits";

describe("tenant workspace limits", () => {
  it("mergeTenantWorkspaceLimits uses defaults when partial empty", () => {
    expect(mergeTenantWorkspaceLimits(null)).toEqual(DEFAULT_TENANT_WORKSPACE_LIMITS);
    expect(mergeTenantWorkspaceLimits({})).toEqual(DEFAULT_TENANT_WORKSPACE_LIMITS);
  });

  it("mergeTenantWorkspaceLimits overrides only valid positive ints", () => {
    expect(
      mergeTenantWorkspaceLimits({
        userChatLimit: 25,
        tenantPortfolioLimit: 0,
        portfolioAccountLimit: 2.5 as unknown as number
      })
    ).toEqual({
      ...DEFAULT_TENANT_WORKSPACE_LIMITS,
      userChatLimit: 25
    });
  });

  it("parseWorkspaceLimitsPayload accepts camelCase object", () => {
    const parsed = parseWorkspaceLimitsPayload({
      userXoptionsLimit: 5,
      userChatLimit: 20,
      tenantPortfolioLimit: 3,
      portfolioAccountLimit: 2
    });
    expect(parsed.ok).toBe(true);
    if (parsed.ok) {
      expect(parsed.value).toEqual({
        userXoptionsLimit: 5,
        userChatLimit: 20,
        tenantPortfolioLimit: 3,
        portfolioAccountLimit: 2
      });
    }
  });

  it("parseWorkspaceLimitsPayload rejects invalid values", () => {
    const parsed = parseWorkspaceLimitsPayload({ userChatLimit: 0 });
    expect(parsed.ok).toBe(false);
  });
});
