import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/** Locks `/watchlist` to workspace-product rail so expand/collapse matches xChat/portfolio (see release 3.10.7). */
describe("watchlist page workspace rail contract", () => {
  const pageSrc = readFileSync(join(process.cwd(), "src/app/watchlist/page.tsx"), "utf8");
  const layoutSrc = readFileSync(join(process.cwd(), "src/app/watchlist/layout.tsx"), "utf8");

  it("uses PortfolioWorkspaceProductShell + workspace rail props + dashboard CSS", () => {
    expect(pageSrc).toContain("<PortfolioWorkspaceProductShell");
    expect(pageSrc).toContain('current="watchlist"');
    expect(pageSrc).toContain("getWorkspaceProductSidebarPropsForSession(session, \"Watchlist\")");
    expect(layoutSrc).toContain('@/app/portfolios/portfolios-dashboard.css');
    expect(layoutSrc).toContain("../xchat/xchat-shell.css");
  });

  it("does not regress to legacy collapsed rail or public rail-only session helper", () => {
    expect(pageSrc).not.toContain("preferCollapsed");
    expect(pageSrc).not.toContain("AppUserAccountPublicRailForSession");
  });
});
