import { describe, expect, it } from "vitest";

import { buildYamlDerived } from "@/modules/xchat/persona-yaml-derived";

describe("buildYamlDerived default xapi tools", () => {
  it("uses synced default tool sequence when xapi is omitted", () => {
    const derived = buildYamlDerived(
      {
        name: "Synced Persona",
        system_prompt: "You are a synced persona for xChat tool validation.",
        model: "grok-4-1-fast-reasoning",
        enable_rag: true,
        default_scope: "global",
        temperature: 0.2
      },
      {
        collectionId: "collection_b75e188e-e7e6-4aa8-8e01-23caf0946236",
        collectionDisplayName: "team-default"
      }
    );

    expect(derived.xapi.tools).toEqual([
      { type: "atx_function" },
      {
        type: "collections_search",
        collection_ids: ["collection_b75e188e-e7e6-4aa8-8e01-23caf0946236"]
      },
      { type: "yahoo_finance" },
      { type: "web_search" },
      { type: "x_search" },
      { type: "code_interpreter" }
    ]);
  });
});
