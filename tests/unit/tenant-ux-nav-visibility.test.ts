import { describe, expect, it } from "vitest";

import { isPathAllowedByTenantUxRoutes } from "@/app/ui/tenant-ux-nav-visibility";

describe("isPathAllowedByTenantUxRoutes", () => {
  it("fail-open when routes unset; deny-all when empty list", () => {
    expect(isPathAllowedByTenantUxRoutes("/xchat", null)).toBe(true);
    expect(isPathAllowedByTenantUxRoutes("/xchat", undefined)).toBe(true);
    expect(isPathAllowedByTenantUxRoutes("/xchat", [])).toBe(false);
  });

  it("matches exact prefix or nested path", () => {
    const routes = ["/portfolio", "/xchat"];
    expect(isPathAllowedByTenantUxRoutes("/portfolio", routes)).toBe(true);
    expect(isPathAllowedByTenantUxRoutes("/portfolio/alerts", routes)).toBe(true);
    expect(isPathAllowedByTenantUxRoutes("/xchat", routes)).toBe(true);
    expect(isPathAllowedByTenantUxRoutes("/xchat/thread", routes)).toBe(true);
    expect(isPathAllowedByTenantUxRoutes("/watchlist", routes)).toBe(false);
    expect(isPathAllowedByTenantUxRoutes("/portfolios", routes)).toBe(false);
  });

  it("strips query string before matching", () => {
    expect(isPathAllowedByTenantUxRoutes("/watchlist?portfolioId=abc", ["/watchlist"])).toBe(true);
  });
});
