import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

describe("admin navigation includes xChat", () => {
  it("hub page lists xChat card linking to /xchat", () => {
    const hubPath = path.join(process.cwd(), "src/app/admin/page.tsx");
    const hub = readFileSync(hubPath, "utf8");
    expect(hub).toMatch(/href:\s*"\/xchat"/);
    expect(hub).toContain("title: \"xChat\"");
  });

  it("admin layout topbar includes xChat", () => {
    const layoutPath = path.join(process.cwd(), "src/app/admin/layout.tsx");
    const layout = readFileSync(layoutPath, "utf8");
    expect(layout).toMatch(/\{\s*href:\s*"\/xchat",\s*label:\s*"xChat"\s*\}/);
  });
});
