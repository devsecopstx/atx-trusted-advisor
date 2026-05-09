import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/** Locks Grok-style workspace footer profile menu structure + billing/sign-out affordances. */
describe("WorkspaceProfileFooterMenu contract", () => {
  const menuSrc = readFileSync(join(process.cwd(), "src/app/ui/workspace-profile-footer-menu.tsx"), "utf8");
  const sidebarSrc = readFileSync(join(process.cwd(), "src/app/ui/workspace-product-sidebar.tsx"), "utf8");

  it("mounts from WorkspaceProductSidebar footer", () => {
    expect(sidebarSrc).toContain("<WorkspaceProfileFooterMenu");
    expect(sidebarSrc).toContain('@/app/ui/workspace-profile-footer-menu');
  });

  it("uses createPortal to document.body with bottom-anchored panel", () => {
    expect(menuSrc).toContain("createPortal");
    expect(menuSrc).toContain("document.body");
    expect(menuSrc).toContain("workspace-profile-footer-menu__panel");
    expect(menuSrc).toContain("bottom:");
  });

  it("includes Profile, Plans & billing, Sign out, and logout API", () => {
    expect(menuSrc).toContain('href="/account/billing"');
    expect(menuSrc).toContain("Plans &amp; billing");
    expect(menuSrc).toMatch(/>\s*Profile\s*</);
    expect(menuSrc).toContain('label="Sign out"');
    expect(menuSrc).toContain("WorkspaceSignOutIcon");
    expect(menuSrc).toContain('fetch("/api/auth/logout"');
  });

  it("places Plans & billing row above the sign-out wrapper", () => {
    const plansIdx = menuSrc.indexOf("Plans &amp; billing");
    const signOutWrapIdx = menuSrc.indexOf("workspace-profile-footer-menu__signout-wrap");
    expect(plansIdx).toBeGreaterThan(-1);
    expect(signOutWrapIdx).toBeGreaterThan(plansIdx);
  });

  it("exposes keyboard shortcut for sign-out confirmation", () => {
    expect(menuSrc).toContain('e.key.toLowerCase() !== "l"');
    expect(menuSrc).toContain("setSignOutShortcutOpen(true)");
  });

  it("wires Feedback modal open event and admin hub link", () => {
    expect(menuSrc).toContain("USER_FEEDBACK_OPEN_EVENT");
    expect(menuSrc).toContain('href="/admin"');
    expect(menuSrc).toMatch(/Admin hub/);
    expect(menuSrc).toContain("RailUserFeedbackDialog");
  });
});
