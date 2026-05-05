import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { ADVISORY_RESOURCE_PILLARS } from "@/lib/marketing/advisory-resource-pillars";
import { RESOURCE_GUIDE_SECTIONS } from "@/lib/marketing/resource-guides-catalog";

describe("Resources guides hub contract", () => {
  it("catalog has four sections with icons, subtitles, and playbooks mirroring advisory pillars", () => {
    expect(RESOURCE_GUIDE_SECTIONS).toHaveLength(4);
    const ids = RESOURCE_GUIDE_SECTIONS.map((s) => s.id);
    expect(ids).toEqual(["platform", "xchat", "wheel", "playbooks"]);
    const icons = new Set(RESOURCE_GUIDE_SECTIONS.map((s) => s.icon));
    expect(icons.size).toBe(4);
    for (const s of RESOURCE_GUIDE_SECTIONS) {
      expect(s.shortLabel.trim().length).toBeGreaterThan(0);
      expect(s.subtitle.trim().length).toBeGreaterThan(0);
    }
    const playbooks = RESOURCE_GUIDE_SECTIONS.find((s) => s.id === "playbooks");
    expect(playbooks?.links.length).toBe(ADVISORY_RESOURCE_PILLARS.length);
  });

  it("guides page wires hub panels, jump chips, and catalog", () => {
    const pageSrc = readFileSync(join(process.cwd(), "src/app/resources/guides/page.tsx"), "utf8");
    expect(pageSrc).toContain("ResourceGuidesHubPanels");
    expect(pageSrc).toContain("RESOURCE_GUIDE_SECTIONS");
    expect(pageSrc).toContain('className="resources-doc-nav__chip"');
    expect(pageSrc).toContain("resources-guides-hub__hero-strong");
  });

  it("panels component maps section icons and panel shell classes", () => {
    const panelSrc = readFileSync(
      join(process.cwd(), "src/app/resources/guides/resource-guides-hub-panels.tsx"),
      "utf8"
    );
    expect(panelSrc).toContain("ResourceGuidesHubPanels");
    expect(panelSrc).toContain("resources-guides-hub__panel-grid");
    expect(panelSrc).toContain("LucideMonitorIcon");
    expect(panelSrc).toContain("RailSidebarZapIcon");
    expect(panelSrc).toContain("LucideBookOpenIcon");
    expect(panelSrc).toContain("WheelCycleIcon");
  });

  it("hub styles define panel grid and section modifiers", () => {
    const css = readFileSync(
      join(process.cwd(), "src/app/resources/getting-started/resources-getting-started.css"),
      "utf8"
    );
    expect(css).toContain(".resources-guides-hub__panel-grid");
    expect(css).toContain(".resources-guides-hub__panel--playbooks");
    expect(css).toContain(".resources-guides-hub__jump");
  });
});
