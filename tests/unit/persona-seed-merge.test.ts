import { describe, expect, it } from "vitest";

import {
    appendToolsByType,
    buildPersonaInsertSetBody,
    computePersonaSeedUpdatePatch
} from "@/modules/xchat/persona-seed-merge";

describe("appendToolsByType", () => {
  it("appends only new tool types", () => {
    const existing = [{ type: "web_search" }, { type: "yahoo_finance" }];
    const candidates = [
      { type: "web_search" },
      { type: "collections_search", collection_ids: ["collection_x"] }
    ];
    expect(appendToolsByType(existing, candidates)).toEqual([
      { type: "web_search" },
      { type: "yahoo_finance" },
      { type: "collections_search", collection_ids: ["collection_x"] }
    ]);
  });
});

describe("computePersonaSeedUpdatePatch merge", () => {
  it("fills collectionId when missing and appends tools by type without changing prompts", () => {
    const existing = {
      xaiCollection: { collectionName: "Old" },
      xapi: {
        mode: "responses",
        toolChoice: "auto",
        maxTurns: 5,
        tools: [{ type: "web_search" }]
      }
    };
    const derived = {
      systemPrompt: "NEW PROMPT SHOULD NOT APPLY IN MERGE",
      overridePrompt: "x",
      enableRag: false,
      defaultScope: "x",
      model: "x",
      temperature: 0.9,
      xaiCollection: { collectionId: "collection_abc", collectionName: "atx-trusted-advisor-dev-xpersonas" },
      xapi: {
        mode: "responses",
        toolChoice: "auto",
        maxTurns: 5,
        tools: [
          { type: "collections_search", collection_ids: ["collection_abc"] },
          { type: "atxfinance" }
        ]
      }
    };
    const patch = computePersonaSeedUpdatePatch(existing, derived, "merge");
    expect(patch.systemPrompt).toBeUndefined();
    expect(patch.overridePrompt).toBeUndefined();
    expect(patch.xaiCollection).toEqual({
      collectionName: "atx-trusted-advisor-dev-xpersonas",
      collectionId: "collection_abc"
    });
    expect((patch.xapi as { tools?: unknown[] })?.tools).toEqual([
      { type: "web_search" },
      { type: "collections_search", collection_ids: ["collection_abc"] },
      { type: "atxfinance" }
    ]);
  });

  it("sets collectionId and collectionName from yaml when id was missing", () => {
    const existing = {};
    const derived = {
      xaiCollection: { collectionId: "collection_z", collectionName: "Named" },
      xapi: { tools: [{ type: "x_search" }] }
    };
    const patch = computePersonaSeedUpdatePatch(existing, derived, "merge");
    expect(patch.xaiCollection).toEqual({
      collectionId: "collection_z",
      collectionName: "Named"
    });
    expect((patch.xapi as { tools?: unknown[] })?.tools).toEqual([{ type: "x_search" }]);
    expect(patch.isSystem).toBe(true);
  });

  it("does not patch xaiCollection when collectionId already set", () => {
    const existing = {
      xaiCollection: { collectionId: "collection_existing", collectionName: "X" },
      xapi: { tools: [{ type: "web_search" }] }
    };
    const derived = {
      xaiCollection: { collectionId: "collection_new", collectionName: "Y" },
      xapi: {
        tools: [{ type: "collections_search", collection_ids: ["collection_new"] }]
      }
    };
    const patch = computePersonaSeedUpdatePatch(existing, derived, "merge");
    expect(patch.xaiCollection).toBeUndefined();
  });
});

describe("computePersonaSeedUpdatePatch replace", () => {
  it("overwrites prompts and xapi; sets xaiCollection when id present", () => {
    const existing = {
      status: "published",
      version: 3,
      publishedAt: new Date(),
      systemPrompt: "old",
      xapi: { mode: "responses", toolChoice: "none", maxTurns: 2, tools: [{ type: "web_search" }] }
    };
    const derived = {
      systemPrompt: "new body text here minimum",
      overridePrompt: "",
      enableRag: true,
      defaultScope: "global",
      model: "grok-4-1-fast-reasoning",
      temperature: 0.2,
      xaiCollection: { collectionId: "collection_r", collectionName: "C" },
      xapi: { mode: "responses", toolChoice: "auto", maxTurns: 5, tools: [{ type: "yahoo_finance" }] }
    };
    const patch = computePersonaSeedUpdatePatch(existing, derived, "replace");
    expect(patch.systemPrompt).toBe(derived.systemPrompt);
    expect(patch.xapi).toEqual(derived.xapi);
    expect(patch.xaiCollection).toEqual(derived.xaiCollection);
    expect(patch.status).toBeUndefined();
    expect(patch.isSystem).toBe(true);
  });

  it("omits xaiCollection when derived has no collection id", () => {
    const existing = {
      xaiCollection: { collectionId: "collection_keep", collectionName: "K" },
      xapi: { tools: [] }
    };
    const derived = {
      systemPrompt: "new body text here minimum",
      overridePrompt: "",
      enableRag: true,
      defaultScope: "global",
      model: "m",
      temperature: 0.2,
      xaiCollection: {},
      xapi: { mode: "responses", toolChoice: "auto", maxTurns: 5, tools: [] }
    };
    const patch = computePersonaSeedUpdatePatch(existing, derived, "replace");
    expect(patch.xaiCollection).toBeUndefined();
  });
});

describe("buildPersonaInsertSetBody", () => {
  it("returns full set body for new upserts", () => {
    const derived = {
      systemPrompt: "hello world prompt text",
      overridePrompt: "",
      model: "m",
      temperature: 0.2,
      enableRag: true,
      defaultScope: "global",
      xaiCollection: { collectionId: "c1" },
      xapi: { mode: "responses", toolChoice: "auto", maxTurns: 5, tools: [] }
    };
    expect(buildPersonaInsertSetBody(derived)).toMatchObject({
      isSystem: true,
      model: "m",
      enableRag: true
    });
  });
});
