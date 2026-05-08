import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

/** Locks Templates heading + workspace library status bar on one flex row above the gallery. */
describe("xChat templates strip + workspace bar layout contract", () => {
  const stripPath = path.join(process.cwd(), "src/app/xchat/ui/xchat-templates-strip.tsx");
  const cssPath = path.join(process.cwd(), "src/app/xchat/xchat.css");
  const strip = readFileSync(stripPath, "utf8");
  const css = readFileSync(cssPath, "utf8");

  it("keeps Templates label and workspace library status in top-row (Templates before bar)", () => {
    expect(strip).toContain('className="xchat-templates-strip__top-row"');
    expect(strip).toContain("XchatTemplatesWorkspaceBar");
    expect(strip).toContain('className="xchat-templates-strip__title">Templates</span>');
    const topRowIx = strip.indexOf("xchat-templates-strip__top-row");
    const titleIx = strip.indexOf("xchat-templates-strip__title");
    const barIx = strip.indexOf("<XchatTemplatesWorkspaceBar");
    expect(topRowIx).toBeGreaterThan(-1);
    expect(titleIx).toBeGreaterThan(-1);
    expect(barIx).toBeGreaterThan(-1);
    expect(topRowIx).toBeLessThan(titleIx);
    expect(titleIx).toBeLessThan(barIx);
  });

  it("defines flex layout for top row and workspace bar shrink", () => {
    expect(css).toContain(".xchat-templates-strip__top-row");
    expect(css).toContain(".xchat-templates-strip__top-row .xchat-workspace-bar");
  });
});
