import { describe, expect, it } from "vitest";

import {
    isPathVisibleForRole,
    parseDefaultLandingPathByRole,
    parseRouteVisibilityOverrides,
    parseTenantRolesByRole,
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

  it("parses tenant role matrix with viewer restrictions", () => {
    const roles = parseTenantRolesByRole({
      viewer: {
        allowedRoutes: ["/xchat", "/portfolios", "/watchlist", "/xoptions", "/account"],
        defaultLanding: "/xchat",
        flags: {
          canMutatePortfolios: true,
          canUseXChat: true,
          canRunTasks: true
        }
      }
    });
    expect(roles.viewer?.allowedRoutes.includes("/xchat")).toBe(true);
    expect(roles.viewer?.flags.canMutatePortfolios).toBe(false);
    expect(roles.viewer?.flags.canUseXChat).toBe(false);
  });
});
