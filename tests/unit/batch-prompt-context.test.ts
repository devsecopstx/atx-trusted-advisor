import { describe, expect, it } from "vitest";

import { appendXchatKbMetadata } from "@/modules/xchat/batch-prompt-context";

describe("appendXchatKbMetadata", () => {
  it("lists persona-linked collection ids and tool lines", () => {
    const text = appendXchatKbMetadata({
      tools: [
        { type: "web_search" },
        { type: "file_search", source: { collection_ids: ["col_a", "col_b"] } },
        { type: "atxfinance" }
      ],
      linkedCollectionIds: ["col_rag", "col_other"]
    });
    expect(text).toContain(
      "Resolved xAI collection ids (persona team KB + tool ids + optional user bootstrap): col_rag, col_other"
    );
    expect(text).not.toContain("ATXFINANCE_COLLECTION_ID");
    expect(text).toContain("- web_search");
    expect(text).toContain("collection_ids: col_a, col_b");
    expect(text).toContain("atxfinance");
  });

  it("notes when no collection ids are declared", () => {
    const text = appendXchatKbMetadata({ tools: [], linkedCollectionIds: [] });
    expect(text).toContain(
      "Resolved xAI collection ids: (none — check xPersona xaiCollection, teamCollection, tools, includeUserBootstrapCollection)"
    );
  });
});
