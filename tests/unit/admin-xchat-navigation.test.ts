import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

describe("admin navigation includes xChat", () => {
  it("admin left rail includes xChat and resources shortcuts", () => {
    const railPath = path.join(process.cwd(), "src/app/admin/ui/admin-left-rail.tsx");
    const rail = readFileSync(railPath, "utf8");
    expect(rail).toContain('href: "/xchat"');
    expect(rail).toContain('label: "xChat"');
    expect(rail).toContain('href: "/resources/guides"');
  });

  it("admin layout renders shell that mounts the left rail", () => {
    const layoutPath = path.join(process.cwd(), "src/app/admin/layout.tsx");
    const layout = readFileSync(layoutPath, "utf8");
    expect(layout).toContain("<AdminLayoutShell>");
    const shellPath = path.join(process.cwd(), "src/app/admin/ui/admin-layout-shell.tsx");
    const shell = readFileSync(shellPath, "utf8");
    expect(shell).toContain("<AdminLeftRail");
  });

  it("delivery channels hub entry mentions xChat API test tab", () => {
    const groupsPath = path.join(process.cwd(), "src/app/admin/ui/admin-hub-sections.ts");
    const groups = readFileSync(groupsPath, "utf8");
    expect(groups).toContain('href: "/admin/delivery-channels"');
    expect(groups).toContain("xChat API test");
  });
});
