import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/** Locks workspace rail copy + structure: Resources nests User Collections; xOptions CTA label. */
describe("WorkspaceProductSidebar rail contract", () => {
  const src = readFileSync(join(process.cwd(), "src/app/ui/workspace-product-sidebar.tsx"), "utf8");

  it("uses Find xOptions for the primary xOptions workspace link", () => {
    expect(src).toContain("Find xOptions");
    expect(src).not.toMatch(/>\s*Open xOptions\s*</);
  });

  it("nests User Collections under Utilities inside the Resources accordion body", () => {
    expect(src).toContain('label="Resources"');
    expect(src).toContain("portfolios-workspace-sidebar__utilities-details");
    expect(src).toContain("UtilitiesSubgroupDetails");
    expect(src).toContain("Utilities");
    expect(src).toContain("portfolios-workspace-sidebar__collections-label");
    expect(src).toContain("User Collections");
    expect(src).toContain("<XchatAttachmentsPanel />");
    expect(src).toContain("portfolios-workspace-sidebar__bottom");
  });

  it("expands Resources routeMatch for attachments deep link and tasks paths", () => {
    expect(src).toContain("xchatAttachmentsDeepLinkActive");
    expect(src).toContain('pathname.startsWith("/account/tasks")');
  });

  it("links consolidated Guides hub under Resources", () => {
    expect(src).toContain('href="/resources/guides"');
    expect(src).toMatch(
      /<SidebarLink href="\/resources\/guides"[^>]*>[\s\S]*?Guides\s*<\/SidebarLink>/
    );
    expect(src).not.toContain('href="/resources/about"');
    expect(src).not.toContain('href="/resources/decision-workflow"');
  });

  it("mounts rail context + accessible header toggle (⌘B contract)", () => {
    expect(src).toContain("WorkspaceProductRailProvider");
    expect(src).toContain('aria-label="Toggle sidebar"');
    expect(src).toContain("workspace-product-sidebar__header");
    expect(src).toContain('aria-controls="workspace-product-sidebar-scroll"');
  });

  it("uses expanded workspace rail width 175px (+25% vs 140px; legacy was 280px)", () => {
    expect(src).toMatch(/WORKSPACE_PRODUCT_RAIL_EXPANDED_WIDTH_PX\s*=\s*175/);
    expect(src).toContain("WORKSPACE_PRODUCT_RAIL_COLLAPSED_WIDTH_PX");
  });
});
