import { describe, expect, it } from "vitest";

import {
    buildOptionsPlaybooksAip160Filter,
    buildResponseGuidelinesAip160Filter,
    inferRiskLevelsFromUserMessage,
    inferStrategyTypesFromUserMessage,
    mergeDedupeFinanceKbSnippets,
    resolveWorkspaceKbRiskLevels,
    userRequestedAdvancedComplexity,
    workspaceSummaryRiskToKbRiskLevels
} from "@/modules/xchat/finance-kb-rag-search";
import type { UserWorkspaceSummaryJson } from "@/modules/xchat/user-workspace-summary-for-prompt";

describe("buildResponseGuidelinesAip160Filter", () => {
  it("scopes xchat + compliance", () => {
    expect(buildResponseGuidelinesAip160Filter("xchat")).toBe(
      `(surface = "xchat" OR doc_type = "compliance")`
    );
  });

  it("scopes reports + compliance", () => {
    expect(buildResponseGuidelinesAip160Filter("reports")).toBe(
      `(surface = "reports" OR doc_type = "compliance")`
    );
  });
});

describe("buildOptionsPlaybooksAip160Filter", () => {
  it("always pins category + complexity", () => {
    expect(
      buildOptionsPlaybooksAip160Filter({
        strategyTypes: [],
        riskLevels: [],
        complexity: "core"
      })
    ).toBe(
      '(category = "options-strategy-core" OR category = "options-strategy-advanced") AND complexity = "core"'
    );
  });

  it("adds strategy and risk OR groups", () => {
    const f = buildOptionsPlaybooksAip160Filter({
      strategyTypes: ["wheel", "iron_condor"],
      riskLevels: ["balanced"],
      complexity: "advanced"
    });
    expect(f).toContain('strategy_type = "wheel" OR strategy_type = "iron_condor"');
    expect(f).toContain('risk_level = "balanced"');
    expect(f).toContain('complexity = "advanced"');
  });
});

describe("inferStrategyTypesFromUserMessage", () => {
  it("detects wheel and iron condor", () => {
    expect(inferStrategyTypesFromUserMessage("Help me run a wheel on TSLA")).toContain("wheel");
    expect(inferStrategyTypesFromUserMessage("Iron condor vs jade lizard")).toEqual(
      expect.arrayContaining(["iron_condor"])
    );
  });
});

describe("inferRiskLevelsFromUserMessage", () => {
  it("detects conservative and aggressive phrasing", () => {
    expect(inferRiskLevelsFromUserMessage("conservative income")).toContain("conservative");
    expect(inferRiskLevelsFromUserMessage("I am aggressive on risk")).toContain("aggressive");
  });
});

describe("workspaceSummaryRiskToKbRiskLevels", () => {
  it("maps moderate to balanced", () => {
    expect(workspaceSummaryRiskToKbRiskLevels("moderate")).toEqual(["balanced"]);
  });
});

describe("resolveWorkspaceKbRiskLevels", () => {
  it("uses active portfolio row when ids match", () => {
    const summary: UserWorkspaceSummaryJson = {
      workspace: {
        activePortfolio: "Main",
        activePortfolioId: "p2",
        portfolios: [
          { name: "Side", id: "p1", holdings: "", cash: "", riskLevel: "conservative" },
          { name: "Main", id: "p2", holdings: "", cash: "", riskLevel: "aggressive" }
        ]
      }
    };
    expect(resolveWorkspaceKbRiskLevels(summary)).toEqual(["aggressive"]);
  });
});

describe("userRequestedAdvancedComplexity", () => {
  it("detects advanced phrasing", () => {
    expect(userRequestedAdvancedComplexity("Show me a multi-leg fly")).toBe(true);
    expect(userRequestedAdvancedComplexity("Wheel basics")).toBe(false);
  });
});

describe("mergeDedupeFinanceKbSnippets", () => {
  it("dedupes by document id + text head", () => {
    const a = mergeDedupeFinanceKbSnippets(
      [{ text: "alpha beta", documentId: "f1" }],
      [{ text: "alpha beta", documentId: "f1" }, { text: "gamma", documentId: "f2" }],
      3
    );
    expect(a).toHaveLength(2);
  });
});
