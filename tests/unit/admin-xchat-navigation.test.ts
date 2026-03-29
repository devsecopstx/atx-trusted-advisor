import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

describe("admin navigation includes xChat", () => {
  it("admin left rail includes xChat and resources shortcuts", () => {
    const railPath = path.join(process.cwd(), "src/app/admin/ui/admin-left-rail.tsx");
    const rail = readFileSync(railPath, "utf8");
    expect(rail).toContain('href: "/xchat"');
    expect(rail).toContain('label: "xChat"');
    expect(rail).toContain('href: "/resources/getting-started"');
  });

  it("admin layout renders persistent left rail", () => {
    const layoutPath = path.join(process.cwd(), "src/app/admin/layout.tsx");
    const layout = readFileSync(layoutPath, "utf8");
    expect(layout).toContain("<AdminLeftRail />");
  });

  it("developer & integration group includes xChat API test link", () => {
    const groupsPath = path.join(process.cwd(), "src/app/admin/ui/admin-hub-sections.ts");
    const groups = readFileSync(groupsPath, "utf8");
    expect(groups).toContain('href: "/admin/xchat-api-test"');
    expect(groups).toContain('title: "xChat API test"');
  });
});
