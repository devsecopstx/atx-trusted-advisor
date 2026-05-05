import { describe, expect, it } from "vitest";

import { isTenantUxEnforcementV2Enabled, isTenantUxPolicyFailClosedEnabled, resolvePolicyPathForRequest } from "@/proxy";

describe("proxy tenant ux helpers", () => {
  it("parses feature flag values", () => {
    expect(isTenantUxEnforcementV2Enabled(undefined)).toBe(false);
    expect(isTenantUxEnforcementV2Enabled("true")).toBe(true);
    expect(isTenantUxEnforcementV2Enabled("1")).toBe(true);
    expect(isTenantUxEnforcementV2Enabled("yes")).toBe(true);
    expect(isTenantUxEnforcementV2Enabled("false")).toBe(false);
  });

  it("parses fail-closed flag for policy resolver outages", () => {
    expect(isTenantUxPolicyFailClosedEnabled(undefined)).toBe(false);
    expect(isTenantUxPolicyFailClosedEnabled("true")).toBe(true);
    expect(isTenantUxPolicyFailClosedEnabled("1")).toBe(true);
    expect(isTenantUxPolicyFailClosedEnabled("false")).toBe(false);
  });

  it("maps product and API paths to policy prefixes", () => {
    expect(resolvePolicyPathForRequest("/xchat")).toBe("/xchat");
    expect(resolvePolicyPathForRequest("/xcoach")).toBe("/xcoach");
    expect(resolvePolicyPathForRequest("/xoptions/wheel")).toBe("/xoptions");
    expect(resolvePolicyPathForRequest("/api/xchat/ask")).toBe("/xchat");
    expect(resolvePolicyPathForRequest("/api/user/watchlist")).toBe("/watchlist");
    expect(resolvePolicyPathForRequest("/api/portfolios/default")).toBe("/portfolio");
    expect(resolvePolicyPathForRequest("/workspace/portfolios")).toBe("/workspace");
    expect(resolvePolicyPathForRequest("/workspace/tasks")).toBe("/workspace/tasks");
    expect(resolvePolicyPathForRequest("/workspace/tasks/run")).toBe("/workspace/tasks");
    expect(resolvePolicyPathForRequest("/admin")).toBeNull();
  });
});
