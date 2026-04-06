import { describe, expect, it } from "vitest";

import { formatThreadForStrategyHandoff } from "@/lib/xchat-strategy-job-handoff";

describe("formatThreadForStrategyHandoff", () => {
  it("labels user and advisor turns and replaces strategy-job offer body with a short note", () => {
    const out = formatThreadForStrategyHandoff([
      { role: "user", content: "Covered call on AAPL" },
      {
        role: "ai",
        content: "### server markdown",
        strategyJobOffer: true
      }
    ]);
    expect(out).toContain("You:");
    expect(out).toContain("Covered call on AAPL");
    expect(out).toContain("Advisor:");
    expect(out).toContain("Structured planning options were offered");
    expect(out).not.toContain("### server markdown");
  });
});
