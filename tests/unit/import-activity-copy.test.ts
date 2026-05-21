import { describe, expect, it } from "vitest";

import { importActivityPageCopy, importActivityWorkflowCopy } from "@/app/import-activity/import-activity-copy";

describe("import-activity copy", () => {
  it("page title and intro mention broker CSV and background import", () => {
    expect(importActivityPageCopy.title.toLowerCase()).toContain("broker");
    expect(importActivityPageCopy.introLead.toLowerCase()).toContain("csv");
    expect(importActivityPageCopy.introBackground.toLowerCase()).toContain("background");
    expect(importActivityPageCopy.introBackground.toLowerCase()).toContain("xoptions");
    expect(importActivityPageCopy.brokerRoadmapNote.toLowerCase()).toContain("forge");
    expect(importActivityPageCopy.brokerRoadmapNote.toLowerCase()).toContain("hiive");
  });

  it("lists three supported file kinds and how-to steps", () => {
    expect(importActivityWorkflowCopy.supportedFiles).toHaveLength(3);
    expect(importActivityWorkflowCopy.supportedFiles.some((s) => s.toLowerCase().includes("account history"))).toBe(
      true
    );
    expect(importActivityWorkflowCopy.howToSteps).toHaveLength(3);
    expect(importActivityWorkflowCopy.howToSteps.some((s) => s.toLowerCase().includes("portfolio"))).toBe(true);
    expect(importActivityWorkflowCopy.stepReviewLabel.toLowerCase()).toContain("review");
    expect(importActivityWorkflowCopy.optionsBody.toLowerCase()).toContain("positive");
    expect(importActivityWorkflowCopy.optionsBody.toLowerCase()).toContain("negative");
    expect(importActivityWorkflowCopy.deleteHoldingsFirstHint.toLowerCase()).toContain("default");
    expect(importActivityWorkflowCopy.deleteHoldingsFirstLabel.toLowerCase()).toContain("delete");
    expect(importActivityWorkflowCopy.importCompleteOpenPortfolio.toLowerCase()).toContain("portfolio");
  });
});
