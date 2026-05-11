import { describe, expect, it } from "vitest";

import {
    buildIncomeIdeasCompactPayload,
    filterRagSnippetsForIncomeIdeas,
    mergeIncomeIdeasRagContext,
    shouldOptimizeIncomeIdeasPrompt
} from "@/modules/xchat/income-ideas-prompt";
import type { WorkspaceSnapshotPreload } from "@/modules/xchat/workspace-snapshot-for-prompt";

describe("shouldOptimizeIncomeIdeasPrompt", () => {
  it("is true for HNWI wheel template copy", () => {
    expect(
      shouldOptimizeIncomeIdeasPrompt(
        "From holdings + watchlist: up to three covered-call or wheel ideas with strike/expiry notes and assignment context."
      )
    ).toBe(true);
  });

  it("is false without holdings+watchlist pairing", () => {
    expect(shouldOptimizeIncomeIdeasPrompt("Give me three wheel ideas for premium income")).toBe(false);
  });
});

describe("filterRagSnippetsForIncomeIdeas", () => {
  it("keeps undated snippets as evergreen guidelines", () => {
    const out = filterRagSnippetsForIncomeIdeas([
      { text: "Conservative wheel: manage assignment risk.", documentName: "a.md" }
    ]);
    expect(out).toHaveLength(1);
  });

  it("drops dated snippets older than 7 days", () => {
    const now = Date.parse("2026-05-10T12:00:00.000Z");
    const out = filterRagSnippetsForIncomeIdeas(
      [{ text: "Idea log 2026-04-01: sell CC on X.", documentName: "b.md" }],
      now
    );
    expect(out).toHaveLength(0);
  });

  it("keeps snippets with a recent ISO date", () => {
    const now = Date.parse("2026-05-10T12:00:00.000Z");
    const out = filterRagSnippetsForIncomeIdeas(
      [{ text: "Desk note 2026-05-09: balanced posture.", documentName: "c.md" }],
      now
    );
    expect(out).toHaveLength(1);
  });
});

describe("mergeIncomeIdeasRagContext", () => {
  it("includes static guidelines when snippets empty", () => {
    const ctx = mergeIncomeIdeasRagContext([]);
    expect(ctx).toContain("Conservative");
    expect(ctx).toContain("Balanced");
    expect(ctx).toContain("Aggressive");
  });
});

describe("buildIncomeIdeasCompactPayload", () => {
  it("maps equity rows and watchlist tickers", () => {
    const preload: WorkspaceSnapshotPreload = {
      promptJson: {
        loadedAt: "2026-05-10T00:00:00.000Z",
        workspaceContentRev: 3,
        portfolio: {
          id: "507f1f77bcf86cd799439011",
          name: "Main",
          isDefault: true,
          totalPositionCount: 1
        },
        accounts: [],
        positionsPreview: [],
        positionsPreviewTruncated: false,
        positionsOmittedCount: 0,
        watchlist: {
          name: "WL",
          riskProfile: null,
          outlook: null,
          symbols: [
            {
              symbol: "NVDA",
              addedAt: "2026-05-10T00:00:00.000Z",
              addedAtDisplay: "May 9, 2026, 8:00 PM UTC",
              spotPriceDisplay: "$100.00",
              targetEntryNotional100xUsdDisplay: "$10,000",
              targetEntryDisplay: "not set",
              targetEntryNotional100xDisplay: "10,000"
            }
          ]
        }
      },
      positionsFull: [
        {
          symbol: "TSLA",
          qty: 100,
          avgCost: 200,
          accountId: "507f1f77bcf86cd799439012",
          positionType: "stock"
        }
      ]
    };
    const quotes = new Map([
      [
        "TSLA",
        {
          symbol: "TSLA",
          price: 220,
          changePercent: 1.2,
          source: "yahoo-finance2" as const
        }
      ]
    ]);
    const p = buildIncomeIdeasCompactPayload(preload, quotes);
    expect(p.kind).toBe("income_ideas_book_v1");
    expect(p.holdings[0]?.ticker).toBe("TSLA");
    expect(p.holdings[0]?.currentValueUsd).toBe(22000);
    expect(p.watchlist[0]?.ticker).toBe("NVDA");
  });
});
