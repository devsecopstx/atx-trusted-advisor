import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/** Locks `/watchlist` to workspace-product rail so expand/collapse matches xChat/portfolio (see release 3.10.7). */
describe("watchlist page workspace rail contract", () => {
  const src = readFileSync(join(process.cwd(), "src/app/watchlist/page.tsx"), "utf8");

  it("uses WorkspaceProductSidebar + workspace-product chrome + dashboard CSS", () => {
    expect(src).toContain('railChrome="workspace-product"');
    expect(src).toContain("<WorkspaceProductSidebar {...workspaceRailProps} />");
    expect(src).toContain("getWorkspaceProductSidebarPropsForSession(session, \"Watchlist\")");
    expect(src).toContain('@/app/portfolios/portfolios-dashboard.css');
    expect(src).toContain("../xchat/xchat.css");
  });

  it("does not regress to legacy collapsed rail or public rail-only session helper", () => {
    expect(src).not.toContain("preferCollapsed");
    expect(src).not.toContain("AppUserAccountPublicRailForSession");
  });
});
