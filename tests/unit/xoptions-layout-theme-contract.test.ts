import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Regression: WorkspaceProductSidebar uses classes from portfolios-dashboard.css
 * (e.g. portfolios-workspace-sidebar__glyph). Without that stylesheet, rail SVGs
 * render at unconstrained intrinsic size.
 */
describe("xoptions layout + soft theme contract", () => {
  it("imports portfolios-dashboard.css for workspace rail sidebar tokens", () => {
    const layout = readFileSync(join(process.cwd(), "src/app/xoptions/layout.tsx"), "utf8");
    expect(layout).toContain("portfolios-dashboard.css");
  });

  it("maps xf-xoptions-surface to app canvas under html[data-xf-ui=soft]", () => {
    const globals = readFileSync(join(process.cwd(), "src/app/globals.css"), "utf8");
    expect(globals).toContain('html[data-xf-ui="soft"]');
    expect(globals).toContain("--xf-xoptions-surface: var(--xf-bg-900)");
  });
});
