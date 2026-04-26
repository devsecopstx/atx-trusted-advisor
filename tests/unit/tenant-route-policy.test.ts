import { describe, expect, it } from "vitest";

import {
    isPathVisibleForRole,
    parseDefaultLandingPathByRole,
    parseRouteVisibilityOverrides,
    resolveDefaultLandingPathForRole
} from "@/modules/platform/tenant-route-policy";

describe("tenant-route-policy", () => {
  it("parses route visibility overrides safely", () => {
    expect(parseRouteVisibilityOverrides(null)).toEqual({});
    expect(
      parseRouteVisibilityOverrides({
        watchlist: false,
        xoptions: true,
        bad: "nope"
      })
    ).toEqual({
      watchlist: false,
      xoptions: true
    });
  });

  it("parses default landing paths by role", () => {
    expect(
      parseDefaultLandingPathByRole({
        advisor: "/xchat/",
        viewer: "watchlist",
        operator: "/portfolios"
      })
    ).toEqual({
      advisor: "/xchat",
      operator: "/portfolios"
    });
  });

  it("resolves visibility with route overrides", () => {
    expect(isPathVisibleForRole("/watchlist", "viewer")).toBe(true);
    expect(
      isPathVisibleForRole("/watchlist", "viewer", {
        watchlist: false
      })
    ).toBe(false);
    expect(
      isPathVisibleForRole("/xoptions/full-chain", "viewer", {
        xoptions: false
      })
    ).toBe(false);
  });

  it("falls back to visible route when landing override is disallowed", () => {
    const path = resolveDefaultLandingPathForRole({
      role: "viewer",
      overrides: { xchat: false, watchlist: true },
      defaultLandingPathByRole: { viewer: "/xchat" }
    });
    expect(path).not.toBe("/xchat");
    expect(path).toBe("/account");
  });
});
