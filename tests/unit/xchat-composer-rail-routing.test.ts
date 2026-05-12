import { describe, expect, it } from "vitest";

import {
    formatXchatComposerRagLine,
    xchatAskDataToComposerRailLastTurn
} from "@/app/xchat/ui/xchat-composer-rail-routing";

describe("xchat-composer-rail-routing", () => {
  it("maps ask payload fields for the composer rail", () => {
    expect(
      xchatAskDataToComposerRailLastTurn({
        model: "grok-4.3",
        modelSelectionSource: "persona",
        contextSource: "xai_collection",
        contextCount: 4,
        collectionSearchStatus: "ready"
      })
    ).toEqual({
      executionModel: "grok-4.3",
      modelSelectionSource: "persona",
      contextSource: "xai_collection",
      contextCount: 4,
      collectionSearchStatus: "ready",
      collectionSearchNonReadyFileCount: undefined
    });
  });

  it("formats RAG summary for the rail", () => {
    expect(formatXchatComposerRagLine(undefined)).toContain("send a turn");
    expect(
      formatXchatComposerRagLine({
        contextSource: "xai_collection",
        contextCount: 2,
        collectionSearchStatus: "ready"
      })
    ).toBe("RAG · xai_collection · 2 chunk(s) · ready");
  });
});
