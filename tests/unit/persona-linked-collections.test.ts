import { describe, expect, it } from "vitest";

import {
    countPersonaLinkedCollections,
    getPersonaLinkedCollectionIds,
    resolveXchatLinkedCollectionIds
} from "@/modules/xchat/persona-linked-collections";

describe("persona linked collections", () => {
  it("counts primary xaiCollection id", () => {
    expect(
      countPersonaLinkedCollections({
        xaiCollection: { collectionId: "collection_a" },
        xapi: { tools: [] }
      })
    ).toBe(1);
  });

  it("dedupes same id from binding and tools", () => {
    const ids = getPersonaLinkedCollectionIds({
      xaiCollection: { collectionId: "collection_a" },
      xapi: {
        tools: [
          { type: "collections_search", collection_ids: ["collection_a", "collection_b"] },
          { type: "file_search", source: { collection_ids: ["collection_b"] } }
        ]
      }
    });
    expect(ids).toHaveLength(2);
    expect(ids.sort()).toEqual(["collection_a", "collection_b"]);
  });

  it("returns 0 when nothing linked", () => {
    expect(
      countPersonaLinkedCollections({
        xaiCollection: { collectionId: "" },
        xapi: { tools: [{ type: "web_search" }] }
      })
    ).toBe(0);
  });

  it("includes teamCollection id in union", () => {
    const ids = getPersonaLinkedCollectionIds({
      xaiCollection: { collectionId: "collection_a" },
      teamCollection: { collectionId: "collection_team" },
      xapi: { tools: [] }
    });
    expect(ids.sort()).toEqual(["collection_a", "collection_team"]);
  });

  it("merges user bootstrap id when persona flag is set", () => {
    const ids = resolveXchatLinkedCollectionIds({
      persona: {
        xaiCollection: { collectionId: "collection_a" },
        includeUserBootstrapCollection: true,
        xapi: { tools: [] }
      },
      userBootstrapCollectionId: "collection_user"
    });
    expect(ids.sort()).toEqual(["collection_a", "collection_user"]);
  });

  it("does not merge user bootstrap when flag is false", () => {
    const ids = resolveXchatLinkedCollectionIds({
      persona: {
        xaiCollection: { collectionId: "collection_a" },
        includeUserBootstrapCollection: false,
        xapi: { tools: [] }
      },
      userBootstrapCollectionId: "collection_user"
    });
    expect(ids).toEqual(["collection_a"]);
  });
});
