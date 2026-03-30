import { describe, expect, it } from "vitest";

import { buildAdminPortfolioSwitchHref } from "@/app/admin/portfolios/ui/admin-portfolio-nav-utils";

describe("buildAdminPortfolioSwitchHref", () => {
  it("preserves sub-routes when switching portfolio id", () => {
    expect(buildAdminPortfolioSwitchHref("/admin/portfolios/old-id/watchlist", "new-id")).toBe(
      "/admin/portfolios/new-id/watchlist"
    );
  });

  it("falls back to accounts when pathname is not under portfolios", () => {
    expect(buildAdminPortfolioSwitchHref("/admin", "abc")).toBe("/admin/portfolios/abc/accounts");
  });

  it("encodes portfolio ids for the URL", () => {
    expect(buildAdminPortfolioSwitchHref(null, "507f1f77bcf86cd799439011")).toBe(
      "/admin/portfolios/507f1f77bcf86cd799439011/accounts"
    );
  });
});
