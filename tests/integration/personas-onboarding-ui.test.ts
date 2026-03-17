import { describe, expect, it } from "vitest";

import {
  DEFAULT_XPERSONA_TEST_SYSTEM_PROMPT,
  EMPTY_CREATE_FORM,
  applySelectedCollectionToPersonaForm,
  type XaiCollectionInventoryOption
} from "@/app/admin/personas/ui/personas-onboarding";

describe("xpersona onboarding ui helpers", () => {
  it("uses requested default system prompt in create form", () => {
    expect(EMPTY_CREATE_FORM.systemPrompt).toBe(DEFAULT_XPERSONA_TEST_SYSTEM_PROMPT);
    expect(DEFAULT_XPERSONA_TEST_SYSTEM_PROMPT).toContain("You are The Architect");
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
