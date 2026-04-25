import { describe, expect, it } from "vitest";

import {
    assertCatalogMatchesWorkspaceProductPrefixes,
    getAppUserRouteCatalog,
    isPathVisibleForRoleByCatalogDefaults,
    listVisiblePrefixPathsForRole
} from "@/modules/platform/app-user-route-catalog";

describe("app-user-route-catalog", () => {
  it("parses and matches APP_USER_PRODUCT_PATH_PREFIXES", () => {
    expect(() => assertCatalogMatchesWorkspaceProductPrefixes()).not.toThrow();
  });

  it("exposes stable catalog kind", () => {
    const c = getAppUserRouteCatalog();
    expect(c.catalogKind).toBe("app_user_route_catalog");
    expect(c.schemaVersion).toBe(1);
    expect(c.tenantAssignableRoles).toEqual(["advisor", "operator", "viewer"]);
  });

  it("resolves longest path first for nested routes", () => {
    expect(isPathVisibleForRoleByCatalogDefaults("/account/billing", "viewer")).toBe(true);
    expect(isPathVisibleForRoleByCatalogDefaults("/admin/users", "viewer")).toBe(false);
    expect(isPathVisibleForRoleByCatalogDefaults("/admin/users", "global_admin")).toBe(true);
  });

  it("applies per-tenant route overrides by route id", () => {
    const withoutOverrides = listVisiblePrefixPathsForRole("viewer");
    expect(withoutOverrides).toContain("/watchlist");
    const withOverrides = listVisiblePrefixPathsForRole("viewer", {
      watchlist: false,
      xoptions: false
    });
    expect(withOverrides).not.toContain("/watchlist");
    expect(withOverrides).not.toContain("/xoptions");
    expect(withOverrides).toContain("/xchat");
  });
});
