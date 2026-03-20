import { afterEach, describe, expect, it } from "vitest";

import { buildBatchUserPromptAugmentation } from "@/modules/xchat/batch-prompt-context";

const prevEnv = process.env.ATXFINANCE_COLLECTION_ID;

afterEach(() => {
  if (prevEnv === undefined) {
    delete process.env.ATXFINANCE_COLLECTION_ID;
  } else {
    process.env.ATXFINANCE_COLLECTION_ID = prevEnv;
  }
});

describe("buildBatchUserPromptAugmentation", () => {
  it("includes ATXFINANCE_COLLECTION_ID default and tool lines", () => {
    delete process.env.ATXFINANCE_COLLECTION_ID;
    const text = buildBatchUserPromptAugmentation({
      tools: [
        { type: "web_search" },
        { type: "file_search", source: { collection_ids: ["col_a", "col_b"] } },
        { type: "atxfinance" }
      ],
      personaRagCollectionId: "col_rag"
    });
    expect(text).toContain("ATXFINANCE_COLLECTION_ID");
    expect(text).toContain("collection_b75e188e-e7e6-4aa8-8e01-23caf0946236");
    expect(text).toContain("Persona RAG / file_search collection");
    expect(text).toContain("col_rag");
    expect(text).toContain("- web_search");
    expect(text).toContain("collection_ids: col_a, col_b");
    expect(text).toContain("atxfinance");
  });

  it("uses env ATXFINANCE_COLLECTION_ID when set", () => {
    process.env.ATXFINANCE_COLLECTION_ID = "env_col_1";
    const text = buildBatchUserPromptAugmentation({ tools: [] });
    expect(text).toContain("env_col_1");
  });
});
