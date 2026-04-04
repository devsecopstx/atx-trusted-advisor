import { describe, expect, it } from "vitest";

import {
    countPersonaLinkedCollections,
    getPersonaLinkedCollectionIds,
    resolveXchatLinkedCollectionIds,
    withLinkedCollectionTools
} from "@/modules/xchat/persona-linked-collections";
import { normalizePersonaXapiConfig } from "@/modules/xchat/types";

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

  it("resolveXchatLinkedCollectionIds is persona/team/tool ids only (no per-user bootstrap)", () => {
    const persona = {
      xaiCollection: { collectionId: "collection_a" },
      xapi: { tools: [] }
    };
    expect(resolveXchatLinkedCollectionIds({ persona })).toEqual(
      getPersonaLinkedCollectionIds(persona)
    );
  });

  it("withLinkedCollectionTools merge unions tool ids with linked ids (default)", () => {
    const base = normalizePersonaXapiConfig({
      mode: "responses",
      toolChoice: "auto",
      maxTurns: 5,
      tools: [{ type: "collections_search", collection_ids: ["a", "b"] }]
    });
    const out = withLinkedCollectionTools(base, ["team_kb"]);
    const cs = out.tools.find((t) => t.type === "collections_search");
    const merged =
      cs?.type === "collections_search" && Array.isArray(cs.collection_ids)
        ? [...cs.collection_ids].sort()
        : [];
    expect(merged).toEqual(["a", "b", "team_kb"].sort());
  });

  it("withLinkedCollectionTools replace uses only linked ids (drops many persona tool ids)", () => {
    const base = normalizePersonaXapiConfig({
      mode: "responses",
      toolChoice: "auto",
      maxTurns: 5,
      tools: [
        { type: "collections_search", collection_ids: ["a", "b", "c", "d", "e", "f", "g"] }
      ]
    });
    const out = withLinkedCollectionTools(base, ["team_a", "team_b"], "replace");
    const cs = out.tools.find((t) => t.type === "collections_search");
    expect(
      cs?.type === "collections_search" && Array.isArray(cs.collection_ids) ? cs.collection_ids : []
    ).toEqual(["team_a", "team_b"]);
  });

  it("withLinkedCollectionTools replace rewires file_search source.collection_ids", () => {
    const base = normalizePersonaXapiConfig({
      mode: "responses",
      toolChoice: "auto",
      maxTurns: 5,
      tools: [{ type: "file_search", source: { collection_ids: ["x", "y", "z"] } }]
    });
    const out = withLinkedCollectionTools(base, ["kb1"], "replace");
    const fs = out.tools.find((t) => t.type === "file_search");
    const ids =
      fs?.type === "file_search"
        ? (fs.source as { collection_ids?: unknown }).collection_ids
        : undefined;
    expect(Array.isArray(ids) ? ids : []).toEqual(["kb1"]);
  });
});
