import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { ADVISORY_RESOURCE_PILLARS } from "@/lib/marketing/advisory-resource-pillars";
import {
    RESOURCE_GUIDE_GROUPS,
    RESOURCE_GUIDE_SECTIONS
} from "@/lib/marketing/resource-guides-catalog";

describe("Resources guides hub contract", () => {
  it("catalog has four sections with icons, groups, subtitles, and playbooks mirroring advisory pillars", () => {
    expect(RESOURCE_GUIDE_SECTIONS).toHaveLength(4);
    expect(RESOURCE_GUIDE_GROUPS).toHaveLength(4);
    const ids = RESOURCE_GUIDE_SECTIONS.map((s) => s.id);
    expect(ids).toEqual(["platform", "xchat", "wheel", "playbooks"]);
    const icons = new Set(RESOURCE_GUIDE_SECTIONS.map((s) => s.icon));
    expect(icons.size).toBe(4);
    const groups = new Set(RESOURCE_GUIDE_SECTIONS.map((s) => s.group));
    expect(groups.size).toBe(4);
    for (const s of RESOURCE_GUIDE_SECTIONS) {
      expect(s.shortLabel.trim().length).toBeGreaterThan(0);
      expect(s.subtitle.trim().length).toBeGreaterThan(0);
      expect(RESOURCE_GUIDE_GROUPS.some((g) => g.id === s.group)).toBe(true);
    }
    const xchat = RESOURCE_GUIDE_SECTIONS.find((s) => s.id === "xchat");
    expect(xchat?.links.some((l) => l.href === "/resources/quant-trader-guide")).toBe(true);
    const playbooks = RESOURCE_GUIDE_SECTIONS.find((s) => s.id === "playbooks");
    expect(playbooks?.links.length).toBe(ADVISORY_RESOURCE_PILLARS.length);
    const platform = RESOURCE_GUIDE_SECTIONS.find((s) => s.id === "platform");
    expect(platform?.links.some((l) => l.href === "/resources/onboarding-checklist")).toBe(true);
  });

  it("guides page wires hub panels, jump chips, and catalog", () => {
    const pageSrc = readFileSync(join(process.cwd(), "src/app/resources/guides/page.tsx"), "utf8");
    expect(pageSrc).toContain("ResourceGuidesHubPanels");
    expect(pageSrc).toContain("RESOURCE_GUIDE_SECTIONS");
    expect(pageSrc).toContain("resources-guides-hub__jump-chip");
    expect(pageSrc).toContain("ResourceGuideJumpIcon");
    expect(pageSrc).toContain("resources-guides-hub__hero-strong");
  });

  it("panels component maps section icons, link icons, and group shells", () => {
    const panelSrc = readFileSync(
      join(process.cwd(), "src/app/resources/guides/resource-guides-hub-panels.tsx"),
      "utf8"
    );
    const iconSrc = readFileSync(
      join(process.cwd(), "src/app/resources/guides/resource-guides-hub-icons.tsx"),
      "utf8"
    );
    expect(panelSrc).toContain("ResourceGuidesHubPanels");
    expect(panelSrc).toContain("resources-guides-hub__groups");
    expect(panelSrc).toContain("RESOURCE_GUIDE_GROUPS");
    expect(panelSrc).toContain("ResourceGuideLinkIcon");
    expect(iconSrc).toContain("ResourceGuideSectionPanelIcon");
    expect(iconSrc).toContain("GuideLayersIcon");
    expect(iconSrc).toContain("GuideWheelIcon");
    expect(iconSrc).toContain("GuideQuantIcon");
  });

  it("hub styles define group shells, panel grid, and jump chips", () => {
    const css = readFileSync(
      join(process.cwd(), "src/app/resources/getting-started/resources-getting-started.css"),
      "utf8"
    );
    expect(css).toContain(".resources-guides-hub__groups");
    expect(css).toContain(".resources-guides-hub__group--library");
    expect(css).toContain(".resources-guides-hub__panel-grid");
    expect(css).toContain(".resources-guides-hub__jump-chip");
    expect(css).toContain(".resources-guides-hub__link-icon-wrap");
  });
});
