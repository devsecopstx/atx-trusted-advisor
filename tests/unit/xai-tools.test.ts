import { describe, expect, it } from "vitest";

import {
    buildWireToolsForXaiResponses,
    personaXapiToolsToXaiRequestTools,
    toXaiRequestTools
} from "@/lib/xai-tools";

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

  it("passes through code_interpreter and adds responses compatibility name", () => {
    const tool = { type: "code_interpreter" };
    const out = toXaiRequestTools([tool]);
    expect(out[0]).toEqual({ type: "code_interpreter", name: "code_interpreter" });
  });
});

describe("personaXapiToolsToXaiRequestTools", () => {
  it("expands atx_function to flat function tool for /v1/responses (name + parameters at root)", () => {
    const out = personaXapiToolsToXaiRequestTools([{ type: "atx_function" }]);
    expect(out).toHaveLength(1);
    const t = out[0] as {
      type?: string;
      name?: string;
      parameters?: { properties?: { operation?: { enum?: string[] } } };
      function?: unknown;
    };
    expect(t.type).toBe("function");
    expect(t.name).toBe("atx_function");
    expect(t.function).toBeUndefined();
    expect(t.parameters?.properties?.operation?.enum).toEqual(
      expect.arrayContaining(["positions_snapshot", "portfolio_summary"])
    );
  });

  it("merges hosted tools with expanded yahoo_finance and atx_function (flat function entries)", () => {
    const out = personaXapiToolsToXaiRequestTools([
      { type: "web_search" },
      { type: "yahoo_finance" },
      { type: "atx_function" }
    ]);
    expect(out.map((t) => t.type)).toEqual(["web_search", "function", "function"]);
    expect((out[1] as { name?: string; function?: unknown }).name).toBe("atx_function");
    expect((out[1] as { function?: unknown }).function).toBeUndefined();
    expect((out[2] as { name?: string }).name).toBe("yahoo_finance");
    expect((out[2] as { function?: unknown }).function).toBeUndefined();
  });
});

describe("buildWireToolsForXaiResponses", () => {
  it("matches personaXapiToolsToXaiRequestTools (single pass — debug logs match ask route)", () => {
    const tools = [
      { type: "web_search" as const },
      { type: "collections_search" as const, collection_ids: ["c1"] },
      { type: "atx_function" as const }
    ];
    const a = personaXapiToolsToXaiRequestTools(tools);
    const b = buildWireToolsForXaiResponses(tools);
    expect(b).toEqual(a);
  });
});

describe("toXaiRequestTools forXaiResponsesApi", () => {
  it("flattens nested OpenAI function shape when forXaiResponsesApi is true", () => {
    const out = toXaiRequestTools(
      [
        {
          type: "function",
          function: {
            name: "demo",
            description: "d",
            parameters: { type: "object", properties: { q: { type: "string" } } }
          }
        }
      ],
      { forXaiResponsesApi: true }
    );
    expect(out[0]).toEqual({
      type: "function",
      name: "demo",
      description: "d",
      parameters: { type: "object", properties: { q: { type: "string" } } }
    });
  });

  it("keeps nested function shape when forXaiResponsesApi is false (chat completions)", () => {
    const nested = {
      type: "function",
      function: {
        name: "demo",
        parameters: { type: "object", properties: {} }
      }
    };
    const out = toXaiRequestTools([nested], { forXaiResponsesApi: false });
    expect((out[0] as { function?: { name?: string } }).function?.name).toBe("demo");
    expect((out[0] as { name?: string }).name).toBe("demo");
  });
});
