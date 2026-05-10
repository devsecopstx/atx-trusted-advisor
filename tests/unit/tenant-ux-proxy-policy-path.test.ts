import { describe, expect, it } from "vitest";

import { resolvePolicyPathForRequest } from "@/modules/platform/tenant-ux-proxy-policy-path";

describe("resolvePolicyPathForRequest", () => {
  it("maps app_user HTML and API paths to catalog policy prefixes", () => {
    expect(resolvePolicyPathForRequest("/xchat")).toBe("/xchat");
    expect(resolvePolicyPathForRequest("/xcoach")).toBe("/xcoach");
    expect(resolvePolicyPathForRequest("/xcoach/module/1")).toBe("/xcoach");
    expect(resolvePolicyPathForRequest("/xoptions/wheel")).toBe("/xoptions");
    expect(resolvePolicyPathForRequest("/api/xchat/ask")).toBe("/xchat");
    expect(resolvePolicyPathForRequest("/api/xchat/ask/stream")).toBe("/xchat");
    expect(resolvePolicyPathForRequest("/api/app-user/xchat/bootstrap")).toBe("/xchat");
    expect(resolvePolicyPathForRequest("/api/strategy-options")).toBe("/xoptions");
    expect(resolvePolicyPathForRequest("/api/strategy-options/expirations")).toBe("/xoptions");
    expect(resolvePolicyPathForRequest("/api/user/watchlist")).toBe("/watchlist");
    expect(resolvePolicyPathForRequest("/api/app-user/symbol-chart")).toBe("/watchlist");
    expect(resolvePolicyPathForRequest("/api/portfolios/abc/alerts")).toBe("/portfolio");
    expect(resolvePolicyPathForRequest("/api/portfolios/abc/alerts/def/narrative")).toBe("/portfolio");
    expect(resolvePolicyPathForRequest("/api/integrations/ibkr/accounts")).toBe("/account");
    expect(resolvePolicyPathForRequest("/api/portfolios/x")).toBe("/portfolio");
    expect(resolvePolicyPathForRequest("/api/tasks")).toBe("/workspace/tasks");
    expect(resolvePolicyPathForRequest("/api/tasks/abc/runs")).toBe("/workspace/tasks");
    expect(resolvePolicyPathForRequest("/api/tenant-tasks/x")).toBe("/workspace");
    expect(resolvePolicyPathForRequest("/workspace/tasks")).toBe("/workspace/tasks");
    expect(resolvePolicyPathForRequest("/workspace/desk")).toBe("/workspace");
  });

  it("returns null for paths with no tenant-ux mapping (edge billing may still skip)", () => {
    expect(resolvePolicyPathForRequest("/admin")).toBeNull();
    expect(resolvePolicyPathForRequest("/api/admin/users")).toBeNull();
    expect(resolvePolicyPathForRequest("/api/health")).toBeNull();
  });
});
