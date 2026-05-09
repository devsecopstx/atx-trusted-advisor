import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

describe("XoptionsWorkspaceProductShell contract", () => {
  const shellSrc = readFileSync(
    join(process.cwd(), "src/app/xoptions/ui/xoptions-workspace-product-shell.tsx"),
    "utf8"
  );
  const pageSrc = readFileSync(join(process.cwd(), "src/app/xoptions/page.tsx"), "utf8");
  const layoutSrc = readFileSync(join(process.cwd(), "src/app/xoptions/layout.tsx"), "utf8");

  it("matches workspace-product viewport lock + footer-under-main (no layout-level GlobalFooter)", () => {
    expect(layoutSrc).toContain("xchat-layout-root");
    expect(layoutSrc).not.toContain("GlobalFooter");
    expect(shellSrc).toContain("workspace-product-sticky-top");
    expect(shellSrc).toContain("workspace-product-approved-header-slot");
    expect(shellSrc).toContain("mainFooter={<GlobalFooter");
    expect(shellSrc).not.toMatch(/<\/AppUserCollapsibleRailLayout>\s*\n\s*<GlobalFooter/);
    expect(shellSrc).toContain("workspaceProductShellClassName");
    expect(shellSrc).toContain("overflow-y-auto overscroll-contain");
  });

  it("mounts shell from authenticated /xoptions page", () => {
    expect(pageSrc).toContain("<XoptionsWorkspaceProductShell");
    expect(pageSrc).toContain("./ui/xoptions-workspace-product-shell");
    expect(pageSrc).not.toContain("<AppUserApprovedHeader");
  });
});
