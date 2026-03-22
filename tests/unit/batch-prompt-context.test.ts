import { describe, expect, it } from "vitest";

import { buildBatchUserPromptAugmentation } from "@/modules/xchat/batch-prompt-context";

describe("buildBatchUserPromptAugmentation", () => {
  it("lists persona-linked collection ids and tool lines", () => {
    const text = buildBatchUserPromptAugmentation({
      tools: [
        { type: "web_search" },
        { type: "file_search", source: { collection_ids: ["col_a", "col_b"] } },
        { type: "atxfinance" }
      ],
      linkedCollectionIds: ["col_rag", "col_other"]
    });
    expect(text).toContain("Persona-linked xAI collection ids (RAG / file_search scope): col_rag, col_other");
    expect(text).not.toContain("ATXFINANCE_COLLECTION_ID");
    expect(text).toContain("- web_search");
    expect(text).toContain("collection_ids: col_a, col_b");
    expect(text).toContain("atxfinance");
  });

  it("notes when no collection ids are declared", () => {
    const text = buildBatchUserPromptAugmentation({ tools: [], linkedCollectionIds: [] });
    expect(text).toContain("Persona-linked xAI collection ids: (none declared on this persona)");
  });
});
