import { ObjectId } from "mongodb";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
  const deleteXaiCollectionMock = vi.fn().mockResolvedValue(undefined);
  const updateManyMock = vi.fn().mockResolvedValue({ modifiedCount: 1 });
  const updateOneMock = vi.fn().mockResolvedValue({ modifiedCount: 1 });
  return { deleteXaiCollectionMock, updateManyMock, updateOneMock };
});

vi.mock("@/lib/xai", () => ({
  deleteXaiCollection: (...args: unknown[]) => mocks.deleteXaiCollectionMock(...args),
  hasXaiManagementApiKey: vi.fn().mockReturnValue(true)
}));

vi.mock("@/lib/mongodb", () => ({
  getDb: vi.fn()
}));

import { getDb } from "@/lib/mongodb";
import { clearPerUserXaiHistoryCollectionForUserTenant } from "@/modules/xchat/user-history-xai-purge";

describe("clearPerUserXaiHistoryCollectionForUserTenant", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getDb).mockResolvedValue({
      collection: vi.fn().mockReturnValue({
        find: vi.fn().mockReturnValue({
          project: vi.fn().mockReturnValue({
            toArray: vi.fn().mockResolvedValue([{ xaiCollectionId: "col_a" }, { xaiCollectionId: "col_a" }])
          })
        }),
        updateMany: mocks.updateManyMock,
        updateOne: mocks.updateOneMock
      })
    } as never);
  });

  it("deletes distinct bootstrap xAI collection ids then clears bindings", async () => {
    await clearPerUserXaiHistoryCollectionForUserTenant({
      userIdHex: "507f1f77bcf86cd799439011",
      tenantIdHex: "507f1f77bcf86cd799439022"
    });

    expect(mocks.deleteXaiCollectionMock).toHaveBeenCalledTimes(1);
    expect(mocks.deleteXaiCollectionMock).toHaveBeenCalledWith("col_a");
    expect(mocks.updateManyMock).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: "507f1f77bcf86cd799439011",
        tenantId: "507f1f77bcf86cd799439022"
      }),
      expect.objectContaining({
        $unset: { xaiCollectionId: "", xaiCollectionName: "" }
      })
    );
    expect(mocks.updateOneMock).toHaveBeenCalledWith(
      { _id: new ObjectId("507f1f77bcf86cd799439011") },
      expect.objectContaining({
        $unset: { xaiCollectionId: "", xaiCollectionName: "" }
      })
    );
  });

  it("no-ops on invalid user id", async () => {
    await clearPerUserXaiHistoryCollectionForUserTenant({ userIdHex: "not-valid" });
    expect(mocks.deleteXaiCollectionMock).not.toHaveBeenCalled();
    expect(vi.mocked(getDb)).not.toHaveBeenCalled();
  });
});
