import { describe, expect, it, vi } from "vitest";

const teamStubs = vi.hoisted(() => ({
  resolveTeamKbCollectionId: vi.fn().mockResolvedValue("collection_for_onboarding_test")
}));

vi.mock("@/modules/xchat/team-xai-collection", () => ({
  getTeamXaiKbCollectionIdSync: () => "collection_for_onboarding_test",
  readRawXaiTeamId: () => "collection_for_onboarding_test",
  resolveTeamKbCollectionId: teamStubs.resolveTeamKbCollectionId
}));

import {
    DEFAULT_XPERSONA_TEST_SYSTEM_PROMPT,
    EMPTY_CREATE_FORM,
    applySelectedCollectionToPersonaForm,
    mergeHostedSearchIntoPersonaTools,
    parsePersonaXapiToolsJson,
    personaToolsIncludeHostedSearch,
    type XaiCollectionInventoryOption
} from "@/app/admin/personas/ui/personas-onboarding";
import { getSuperAgentDefaultTools } from "@/modules/xchat/types";

describe("xpersona onboarding ui helpers", () => {
  it("uses requested default system prompt in create form", () => {
    expect(EMPTY_CREATE_FORM.systemPrompt).toBe(DEFAULT_XPERSONA_TEST_SYSTEM_PROMPT);
    expect(DEFAULT_XPERSONA_TEST_SYSTEM_PROMPT).toContain("You are The Architect");
  });

  it("defaults create form xapi tools to the full standard preset (all on)", () => {
    expect(parsePersonaXapiToolsJson(EMPTY_CREATE_FORM.xapiToolsJson)).toEqual(getSuperAgentDefaultTools());
  });

  it("detects hosted search markers in persona tools", () => {
    expect(personaToolsIncludeHostedSearch([{ type: "atxfinance" }])).toBe(false);
    expect(personaToolsIncludeHostedSearch([{ type: "web_search" }])).toBe(true);
    expect(personaToolsIncludeHostedSearch([{ type: "x_search" }])).toBe(true);
  });

  it("mergeHostedSearchIntoPersonaTools prepends missing web and X search", () => {
    expect(mergeHostedSearchIntoPersonaTools([])).toEqual([{ type: "web_search" }, { type: "x_search" }]);
    expect(mergeHostedSearchIntoPersonaTools([{ type: "atxfinance" }])).toEqual([
      { type: "web_search" },
      { type: "x_search" },
      { type: "atxfinance" }
    ]);
    expect(mergeHostedSearchIntoPersonaTools([{ type: "web_search" }, { type: "x_search" }])).toEqual([
      { type: "web_search" },
      { type: "x_search" }
    ]);
  });

  it("maps selected collection to id and display name", () => {
    const collections: XaiCollectionInventoryOption[] = [
      {
        id: "collection_architect",
        name: "Architect Knowledge",
        stats: {
          documentCount: 4,
          createdAt: null,
          updatedAt: null
        }
      }
    ];

    const updated = applySelectedCollectionToPersonaForm(
      EMPTY_CREATE_FORM,
      collections,
      "collection_architect"
    );

    expect(updated.xaiCollectionId).toBe("collection_architect");
    expect(updated.xaiCollectionName).toBe("Architect Knowledge");
  });

  it("keeps existing collection name for unknown id manual fallback", () => {
    const updated = applySelectedCollectionToPersonaForm(
      {
        ...EMPTY_CREATE_FORM,
        xaiCollectionName: "Manual Name"
      },
      [],
      "collection_manual"
    );

    expect(updated.xaiCollectionId).toBe("collection_manual");
    expect(updated.xaiCollectionName).toBe("Manual Name");
  });

  it("clears collection name when selection is reset", () => {
    const updated = applySelectedCollectionToPersonaForm(
      {
        ...EMPTY_CREATE_FORM,
        xaiCollectionId: "collection_architect",
        xaiCollectionName: "Architect Knowledge"
      },
      [],
      ""
    );

    expect(updated.xaiCollectionId).toBe("");
    expect(updated.xaiCollectionName).toBe("");
  });
});
