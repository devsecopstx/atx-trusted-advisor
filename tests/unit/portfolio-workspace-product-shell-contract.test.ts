import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { readXchatShellCss } from "../helpers/read-xchat-stylesheet";

describe("PortfolioWorkspaceProductShell contract", () => {
  const shellSrc = readFileSync(
    join(process.cwd(), "src/app/portfolio/ui/portfolio-workspace-product-shell.tsx"),
    "utf8"
  );
  const portfolioPageSrc = readFileSync(join(process.cwd(), "src/app/portfolio/page.tsx"), "utf8");
  const portfolioLayoutSrc = readFileSync(join(process.cwd(), "src/app/portfolio/layout.tsx"), "utf8");
  const xchatCssSrc = readXchatShellCss();
  const cssSrc = readFileSync(join(process.cwd(), "src/app/portfolios/portfolios-dashboard.css"), "utf8");

  it("locks viewport shell + sticky chrome classes shared with /portfolios", () => {
    expect(portfolioLayoutSrc).toContain("xchat-layout-root");
    expect(xchatCssSrc).toMatch(/\.xchat-layout-root\s*\{[^}]*height:\s*100dvh/s);
    expect(shellSrc).toContain("xchat-shell");
    expect(shellSrc).toContain("workspace-product-sticky-top");
    expect(shellSrc).toContain("workspace-product-approved-header-slot");
    expect(shellSrc).toContain("mainFooter={<WorkspaceProductLegalFooter");
    expect(shellSrc).not.toMatch(/<\/AppUserCollapsibleRailLayout>\s*\n\s*<GlobalFooter/);
    expect(shellSrc).toContain("workspaceProductShellClassName");
    expect(shellSrc).toContain("mainScrollClassName");
    expect(shellSrc).toContain('"overflow-y-auto"');
    expect(shellSrc).toContain('"overscroll-contain"');
    expect(cssSrc).toContain(".workspace-product-approved-header-slot");
    expect(cssSrc).toContain(".workspace-product-sticky-top");
  });

  it("mounts shell from authenticated /portfolio page", () => {
    expect(portfolioPageSrc).toContain("<PortfolioWorkspaceProductShell");
    expect(portfolioPageSrc).toContain('@/app/portfolio/ui/portfolio-workspace-product-shell');
    expect(portfolioPageSrc).not.toContain("<AppUserApprovedHeader");
  });
});
