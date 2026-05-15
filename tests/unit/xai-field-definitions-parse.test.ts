import { describe, expect, it } from "vitest";

import { parseXaiCollectionFieldDefinitionKeysFromPayload } from "@/lib/xai";

describe("parseXaiCollectionFieldDefinitionKeysFromPayload", () => {
  it("reads snake_case field_definitions", () => {
    expect(
      parseXaiCollectionFieldDefinitionKeysFromPayload({
        field_definitions: [{ key: "author" }, { key: "year" }]
      })
    ).toEqual(["author", "year"]);
  });

  it("reads camelCase fieldDefinitions and alternate row key props", () => {
    expect(
      parseXaiCollectionFieldDefinitionKeysFromPayload({
        collection_id: "collection_x",
        fieldDefinitions: [{ key: "slug" }, { Key: "docType" }, { fieldKey: "segment" }]
      })
    ).toEqual(["slug", "docType", "segment"]);
  });

  it("returns empty array when definitions missing", () => {
    expect(parseXaiCollectionFieldDefinitionKeysFromPayload({ collection_name: "x" })).toEqual([]);
  });
});
