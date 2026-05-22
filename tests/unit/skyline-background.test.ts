import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = join(process.cwd(), "src");

describe("root skyline background", () => {
  it("FullBleedBackground uses dual next/image skyline layers with priority load and dimensions", () => {
    const src = readFileSync(join(ROOT, "components/FullBleedBackground.tsx"), "utf8");
    expect(src).toContain('from "next/image"');
    expect(src).toContain('xf-skyline-layer--day');
    expect(src).toContain('xf-skyline-layer--night');
    expect(src).toContain("priority");
    expect(src).toContain("width={SKYLINE_WIDTH}");
    expect(src).toContain("height={SKYLINE_HEIGHT}");
    expect(src).toContain("atx-skyline-day.png");
    expect(src).toContain("atx-skyline-night.png");
    expect(src).toContain("starfield--stars-a");
    expect(src).toContain("starfield--accent-b");
  });

  it("globals.css cross-fades skyline and animates night starfield", () => {
    const css = readFileSync(join(ROOT, "app/globals.css"), "utf8");
    expect(css).toContain(".xf-skyline-layer");
    expect(css).not.toContain("xf-skyline-night-drift");
    expect(css).not.toContain("starfield-sky-pan");
    expect(css).toContain("starfield--stars-a");
    expect(css).toContain("starfield--accent-b");
    expect(css).toContain("starfield-sky-twinkle");
    expect(css).toContain('html[data-xf-ui="soft"]');
    expect(css).toContain("@media (prefers-reduced-motion: reduce)");
  });

  it("SkylineTimeBoot sets data-skyline only once on mount for system preference", () => {
    const src = readFileSync(join(ROOT, "components/SkylineTimeBoot.tsx"), "utf8");
    expect(src).toContain('setAttribute("data-skyline"');
    expect(src).toContain('!== "system"');
    expect(src.match(/useEffect\(/g)?.length).toBe(1);
    expect(src).toContain("[]");
  });
});
