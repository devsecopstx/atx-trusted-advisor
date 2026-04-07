import { describe, expect, it } from "vitest";

import { importActivityPageCopy, importActivityWorkflowCopy } from "@/app/import-activity/import-activity-copy";

describe("import-activity copy", () => {
  it("page title and intro mention broker CSV and background import", () => {
    expect(importActivityPageCopy.title.toLowerCase()).toContain("broker");
    expect(importActivityPageCopy.introLead.toLowerCase()).toContain("csv");
    expect(importActivityPageCopy.introBackground.toLowerCase()).toContain("background");
    expect(importActivityPageCopy.introBackground.toLowerCase()).toContain("xoptions");
  });

  it("lists three supported file kinds and how-to steps", () => {
    expect(importActivityWorkflowCopy.supportedFiles).toHaveLength(3);
    expect(importActivityWorkflowCopy.supportedFiles.some((s) => s.toLowerCase().includes("account history"))).toBe(
      true
    );
    expect(importActivityWorkflowCopy.howToSteps).toHaveLength(3);
    expect(importActivityWorkflowCopy.howToSteps.some((s) => s.includes("Broker ref"))).toBe(true);
    expect(importActivityWorkflowCopy.optionsBody.toLowerCase()).toContain("net-long");
    expect(importActivityWorkflowCopy.cleanBody.toLowerCase()).toContain("fresh start");
  });
});
