import { describe, expect, it } from "vitest";

import { getInvestmentOutlookRefreshEnabled } from "@/lib/feature-flags";
import { DEFAULT_TENANT_WORKSPACE_LIMITS } from "@/modules/identity/tenant-workspace-limits";

describe("getInvestmentOutlookRefreshEnabled", () => {
  it("is false when env gate is off regardless of tenant limits", () => {
    expect(
      getInvestmentOutlookRefreshEnabled({
        envEnabled: false,
        tenantLimits: { ...DEFAULT_TENANT_WORKSPACE_LIMITS, outlookRefreshEnabled: true }
      })
    ).toBe(false);
  });

  it("is false when tenant disables outlook refresh even if env is on", () => {
    expect(
      getInvestmentOutlookRefreshEnabled({
        envEnabled: true,
        tenantLimits: { ...DEFAULT_TENANT_WORKSPACE_LIMITS, outlookRefreshEnabled: false }
      })
    ).toBe(false);
  });

  it("is true when env is on and tenant limit is not false", () => {
    expect(
      getInvestmentOutlookRefreshEnabled({
        envEnabled: true,
        tenantLimits: DEFAULT_TENANT_WORKSPACE_LIMITS
      })
    ).toBe(true);
  });
});
