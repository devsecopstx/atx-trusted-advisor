import { describe, expect, it } from "vitest";

import { toXaiRequestTools } from "@/lib/xai-tools";

describe("toXaiRequestTools", () => {
  it("maps collections_search with ids to file_search source", () => {
    expect(
      toXaiRequestTools([
        { type: "collections_search", collection_ids: ["col_uuid_12345"] },
        { type: "web_search" }
      ])
    ).toEqual([
      { type: "file_search", source: { collection_ids: ["col_uuid_12345"] } },
      { type: "web_search" }
    ]);
  });

  it("maps empty collections_search ids to bare file_search", () => {
    expect(toXaiRequestTools([{ type: "collections_search", collection_ids: [] }])).toEqual([
      { type: "file_search" }
    ]);
  });

  it("passes through web_search and shallow-copies objects", () => {
    const tool = { type: "x_search", foo: 1 };
    const out = toXaiRequestTools([tool]);
    expect(out[0]).toEqual({ type: "x_search", foo: 1 });
    expect(out[0]).not.toBe(tool);
  });
});
