import { describe, expect, it } from "vitest";

import { buildWorkspaceOnboardingCoveredCallPrompt } from "@/lib/workspace-onboarding-prompt";

describe("buildWorkspaceOnboardingCoveredCallPrompt", () => {
  it("includes symbol when valid equity ticker", () => {
    const p = buildWorkspaceOnboardingCoveredCallPrompt("tsla");
    expect(p).toContain("TSLA");
    expect(p.toLowerCase()).toContain("covered-call");
  });

  it("falls back to generic copy without symbol", () => {
    const p = buildWorkspaceOnboardingCoveredCallPrompt(null);
    expect(p).toContain("largest stock holding");
    expect(p.toLowerCase()).toContain("not financial advice");
  });
});
