import { describe, expect, it } from "vitest";

import { personaXapiToolsToXaiRequestTools, toXaiRequestTools } from "@/lib/xai-tools";

describe("toXaiRequestTools", () => {
  it("maps collections_search with ids to file_search vector_store_ids", () => {
    expect(
      toXaiRequestTools([
        { type: "collections_search", collection_ids: ["col_uuid_12345"] },
        { type: "web_search" }
      ])
    ).toEqual([
      { type: "file_search", name: "file_search", vector_store_ids: ["col_uuid_12345"] },
      { type: "web_search", name: "web_search" }
    ]);
  });

  it("drops collections_search when ids are empty (Responses API requires vector_store_ids)", () => {
    expect(toXaiRequestTools([{ type: "collections_search", collection_ids: [] }])).toEqual([]);
  });

  it("maps file_search source.collection_ids to vector_store_ids", () => {
    expect(
      toXaiRequestTools([
        { type: "file_search", source: { collection_ids: ["a", "b"] } }
      ])
    ).toEqual([{ type: "file_search", name: "file_search", vector_store_ids: ["a", "b"] }]);
  });

  it("passes through web_search and shallow-copies objects", () => {
    const tool = { type: "x_search", foo: 1 };
    const out = toXaiRequestTools([tool]);
    expect(out[0]).toEqual({ type: "x_search", name: "x_search", foo: 1 });
    expect(out[0]).not.toBe(tool);
  });
});

describe("personaXapiToolsToXaiRequestTools", () => {
  it("expands atxfinance marker to function tool with positions_snapshot in enum", () => {
    const out = personaXapiToolsToXaiRequestTools([{ type: "atxfinance" }]);
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({
      type: "function",
      function: expect.objectContaining({
        name: "atxfinance",
        parameters: expect.objectContaining({
          properties: expect.objectContaining({
            operation: expect.objectContaining({
              enum: expect.arrayContaining(["positions_snapshot", "portfolio_summary"])
            })
          })
        })
      })
    });
  });

  it("merges hosted tools with expanded yahoo_finance and atxfinance", () => {
    const out = personaXapiToolsToXaiRequestTools([
      { type: "web_search" },
      { type: "yahoo_finance" },
      { type: "atxfinance" }
    ]);
    expect(out.map((t) => t.type)).toEqual(["web_search", "function", "function"]);
    expect((out[1] as { function?: { name?: string } }).function?.name).toBe("atxfinance");
    expect((out[2] as { function?: { name?: string } }).function?.name).toBe("yahoo_finance");
  });
});
