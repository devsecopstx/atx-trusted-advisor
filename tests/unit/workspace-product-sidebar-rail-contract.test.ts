import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/** Locks workspace rail copy + structure; Resources/Admin hub moved to sticky header + mobile top chrome. */
describe("WorkspaceProductSidebar rail contract", () => {
  const src = readFileSync(join(process.cwd(), "src/app/ui/workspace-product-sidebar.tsx"), "utf8");
  const approvedHeaderSrc = readFileSync(join(process.cwd(), "src/app/ui/app_user-approved-header.tsx"), "utf8");

  it("uses Find xOptions for the primary xOptions workspace link", () => {
    expect(src).toContain("Find xOptions");
    expect(src).not.toMatch(/>\s*Open xOptions\s*</);
  });

  it("keeps User collections + attachments panel in main rail nav (no Resources accordion)", () => {
    expect(src).toContain('label="User collections"');
    expect(src).toContain("portfolios-workspace-sidebar__collections-label");
    expect(src).toContain("User Collections");
    expect(src).toContain("<XchatAttachmentsPanel />");
    expect(src).not.toContain("portfolios-workspace-sidebar__bottom");
    expect(src).not.toContain('label="Resources"');
    expect(src).not.toContain("UtilitiesSubgroupDetails");
  });

  it("opens User collections accordion from attachments deep link", () => {
    expect(src).toContain("xchatAttachmentsDeepLinkActive");
    expect(src).toContain("utilitiesAttachmentsRouteMatch");
  });

  it("surfaces Guides, desk shortcuts, Hub in approved header quick nav and mobile top chrome pills", () => {
    expect(approvedHeaderSrc).toContain("/resources/guides");
    expect(approvedHeaderSrc).toContain("/import-activity");
    expect(approvedHeaderSrc).toContain("/account/tasks");
    expect(approvedHeaderSrc).toContain('href="/admin"');
    expect(approvedHeaderSrc).toContain("xchat-header-workspace-quick-nav");
    expect(src).toContain('href="/resources/guides"');
    expect(src).toContain("workspace-top-chrome__pill--admin");
  });

  it("mounts rail context + accessible header toggle (⌘B contract)", () => {
    expect(src).toContain("WorkspaceProductRailProvider");
    expect(src).toContain('aria-label="Toggle sidebar"');
    expect(src).toContain("workspace-product-sidebar__header");
    expect(src).toContain('aria-controls="workspace-product-sidebar-scroll"');
  });

  it("renders WorkspaceProfileFooterMenu in the workspace footer (profile popover)", () => {
    expect(src).toContain("<WorkspaceProfileFooterMenu");
    expect(src).toContain('@/app/ui/workspace-profile-footer-menu');
  });

  it("uses expanded workspace rail width 175px (+25% vs 140px; legacy was 280px)", () => {
    expect(src).toMatch(/WORKSPACE_PRODUCT_RAIL_EXPANDED_WIDTH_PX\s*=\s*175/);
    expect(src).toContain("WORKSPACE_PRODUCT_RAIL_COLLAPSED_WIDTH_PX");
  });
});
