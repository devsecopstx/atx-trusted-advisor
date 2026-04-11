import { beforeEach, describe, expect, it, vi } from "vitest";

const xaiMocks = vi.hoisted(() => ({
  hasXaiManagementApiKey: vi.fn(),
  listXaiCollections: vi.fn()
}));

vi.mock("@/lib/xai", () => xaiMocks);

import { tryInferSingleXaiTeamIdFromManagementApi } from "@/modules/platform/tenant-xchat-team-collection";

describe("tryInferSingleXaiTeamIdFromManagementApi", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns undefined when management key is missing", async () => {
    xaiMocks.hasXaiManagementApiKey.mockReturnValue(false);
    await expect(tryInferSingleXaiTeamIdFromManagementApi()).resolves.toBeUndefined();
    expect(xaiMocks.listXaiCollections).not.toHaveBeenCalled();
  });

  it("returns the only team id when list has one distinct teamId", async () => {
    xaiMocks.hasXaiManagementApiKey.mockReturnValue(true);
    xaiMocks.listXaiCollections.mockResolvedValue([
      { id: "c1", name: "A", teamId: "team-abc" },
      { id: "c2", name: "B", teamId: "team-abc" }
    ]);
    await expect(tryInferSingleXaiTeamIdFromManagementApi()).resolves.toBe("team-abc");
  });

  it("returns undefined when multiple team ids", async () => {
    xaiMocks.hasXaiManagementApiKey.mockReturnValue(true);
    xaiMocks.listXaiCollections.mockResolvedValue([
      { id: "c1", teamId: "t1" },
      { id: "c2", teamId: "t2" }
    ]);
    await expect(tryInferSingleXaiTeamIdFromManagementApi()).resolves.toBeUndefined();
  });

  it("returns undefined when no teamId on collections", async () => {
    xaiMocks.hasXaiManagementApiKey.mockReturnValue(true);
    xaiMocks.listXaiCollections.mockResolvedValue([{ id: "c1", name: "orphan" }]);
    await expect(tryInferSingleXaiTeamIdFromManagementApi()).resolves.toBeUndefined();
  });
});
