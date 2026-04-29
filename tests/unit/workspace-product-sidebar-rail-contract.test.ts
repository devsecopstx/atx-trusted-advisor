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

  it("nests User Collections under the Resources accordion body", () => {
    expect(src).toContain('label="Resources"');
    expect(src).toContain("portfolios-workspace-sidebar__collections-label");
    expect(src).toContain("User Collections");
    expect(src).toContain("<XchatAttachmentsPanel />");
    expect(src).toContain("portfolios-workspace-sidebar__bottom");
  });

  it("expands Resources routeMatch for attachments deep link and tasks paths", () => {
    expect(src).toContain("xchatAttachmentsDeepLinkActive");
    expect(src).toContain('pathname.startsWith("/account/tasks")');
  });
});
