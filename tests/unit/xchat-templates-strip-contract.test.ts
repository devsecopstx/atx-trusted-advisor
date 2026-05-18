import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { readXchatThreadCss } from "../helpers/read-xchat-stylesheet";

/** Locks compact workspace library header + pill scroller contract above the composer. */
describe("xChat templates strip + workspace library layout contract", () => {
  const stripPath = path.join(process.cwd(), "src/app/xchat/ui/xchat-templates-strip.tsx");
  const strip = readFileSync(stripPath, "utf8");
  const css = readXchatThreadCss();

  it("keeps workspace library header cluster before actions in top-row", () => {
    expect(strip).toContain('className="xchat-templates-strip__top-row"');
    expect(strip).toContain('className="xchat-templates-strip__header-main"');
    expect(strip).toContain('className="xchat-templates-strip__library-heading">Workspace library</span>');
    expect(strip).toContain("xchat-templates-strip__ready-badge");
    expect(strip).toContain("ready");
    expect(strip).toContain('className="xchat-templates-strip__header-actions"');
    expect(strip).toContain("xchat-workspace-bar__pulse");
    const topRowIx = strip.indexOf("xchat-templates-strip__top-row");
    const mainIx = strip.indexOf("xchat-templates-strip__header-main");
    const actionsIx = strip.indexOf("xchat-templates-strip__header-actions");
    expect(topRowIx).toBeGreaterThan(-1);
    expect(mainIx).toBeGreaterThan(-1);
    expect(actionsIx).toBeGreaterThan(-1);
    expect(topRowIx).toBeLessThan(mainIx);
    expect(mainIx).toBeLessThan(actionsIx);
  });

  it("exposes keyboard-scrollable pill row with group semantics when collapsed", () => {
    expect(strip).toContain('role="group"');
    expect(strip).toContain("xchat-templates-strip__scroller--pills");
    expect(strip).toContain("xchat-templates-strip__card--pill");
  });

  it("defines compact header + pill scroller styles", () => {
    expect(css).toContain(".xchat-templates-strip__top-row");
    expect(css).toContain(".xchat-templates-strip__header-main");
    expect(css).toContain(".xchat-templates-strip__scroller--pills");
    expect(css).toContain(".xchat-templates-strip__card--pill");
  });
});
