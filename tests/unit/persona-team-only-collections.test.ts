import { beforeEach, describe, expect, it, vi } from "vitest";

const teamMocks = vi.hoisted(() => ({
  resolveTeamKbCollectionId: vi.fn()
}));

vi.mock("@/modules/xchat/team-xai-collection", () => teamMocks);

import { resolveXchatTeamOnlyLinkedCollectionIds } from "@/modules/xchat/persona-linked-collections";

describe("resolveXchatTeamOnlyLinkedCollectionIds", () => {
  beforeEach(() => {
    teamMocks.resolveTeamKbCollectionId.mockResolvedValue("env_team");
  });

  it("dedupes env id with same persona teamCollection", async () => {
    const ids = await resolveXchatTeamOnlyLinkedCollectionIds({
      teamCollection: { collectionId: "env_team" }
    });
    expect(ids).toEqual(["env_team"]);
  });

  it("includes persona teamCollection and env when distinct", async () => {
    const ids = await resolveXchatTeamOnlyLinkedCollectionIds({
      teamCollection: { collectionId: "persona_team" },
      xaiCollection: { collectionId: "ignored_xai" }
    });
    expect(ids).toEqual(["persona_team", "env_team"]);
  });
});
