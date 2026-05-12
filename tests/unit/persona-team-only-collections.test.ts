import { beforeEach, describe, expect, it, vi } from "vitest";

const teamMocks = vi.hoisted(() => ({
  resolveTeamKbCollectionId: vi.fn()
}));

vi.mock("@/modules/xchat/team-xai-collection", () => teamMocks);

import { getXaiFinanceCollectionId } from "@/lib/xai-finance-collection";
import {
    MAX_XCHAT_TEAM_KB_COLLECTION_IDS,
    resolveXchatPersonaDeclaredCollectionIds,
    resolveXchatTeamOnlyLinkedCollectionIds
} from "@/modules/xchat/persona-linked-collections";

describe("resolveXchatPersonaDeclaredCollectionIds", () => {
  it("returns canonical Finance collection when persona has no collection links", () => {
    expect(resolveXchatPersonaDeclaredCollectionIds({})).toEqual([getXaiFinanceCollectionId()]);
  });

  it("ignores legacy persona-linked collections at runtime", () => {
    const financeId = getXaiFinanceCollectionId();
    const ids = resolveXchatPersonaDeclaredCollectionIds({
      xaiCollection: { collectionId: "c1" },
      teamCollection: { collectionId: "c2" },
      xapi: {
        mode: "responses",
        toolChoice: "auto",
        maxTurns: 5,
        tools: [{ type: "collections_search", collection_ids: ["c3"] }]
      }
    });
    expect(ids).toEqual([financeId]);
    expect(ids).toHaveLength(1);
    expect(MAX_XCHAT_TEAM_KB_COLLECTION_IDS).toBeGreaterThanOrEqual(1);
  });
});

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
