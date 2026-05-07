import { describe, expect, it } from "vitest";

import { buildRagLexicalCacheKey } from "@/modules/xchat/rag-lexical-cache";

describe("buildRagLexicalCacheKey", () => {
  it("is stable for same ids/query/limit regardless of collection id order", () => {
    const a = buildRagLexicalCacheKey({
      collectionIds: ["z", "a"],
      query: "Hello",
      limit: 8
    });
    const b = buildRagLexicalCacheKey({
      collectionIds: ["a", "z"],
      query: "hello",
      limit: 8
    });
    expect(a).toBe(b);
  });

  it("changes when limit changes", () => {
    const a = buildRagLexicalCacheKey({
      collectionIds: ["x"],
      query: "q",
      limit: 5
    });
    const b = buildRagLexicalCacheKey({
      collectionIds: ["x"],
      query: "q",
      limit: 6
    });
    expect(a).not.toBe(b);
  });
});
