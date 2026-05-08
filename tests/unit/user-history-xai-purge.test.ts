import { ObjectId } from "mongodb";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/xai", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/xai")>();
  return {
    ...actual,
    deleteXaiCollection: vi.fn(),
    hasXaiManagementApiKey: vi.fn()
  };
});

vi.mock("@/lib/mongodb", () => ({
  getDb: vi.fn()
}));

import { getDb } from "@/lib/mongodb";
import * as Xai from "@/lib/xai";
import { clearPerUserXaiHistoryCollectionForUserTenant } from "@/modules/xchat/user-history-xai-purge";

describe("clearPerUserXaiHistoryCollectionForUserTenant", () => {
  const updateManyMock = vi.fn().mockResolvedValue({ modifiedCount: 1 });
  const updateOneMock = vi.fn().mockResolvedValue({ modifiedCount: 1 });

  beforeEach(() => {
    vi.mocked(Xai.hasXaiManagementApiKey).mockReturnValue(true);
    vi.mocked(Xai.deleteXaiCollection).mockResolvedValue(undefined);

    vi.mocked(getDb).mockResolvedValue({
      collection: vi.fn().mockReturnValue({
        find: vi.fn().mockReturnValue({
          project: vi.fn().mockReturnValue({
            toArray: vi.fn().mockResolvedValue([{ xaiCollectionId: "col_a" }, { xaiCollectionId: "col_a" }])
          })
        }),
        updateMany: updateManyMock,
        updateOne: updateOneMock
      })
    } as never);
  });

  it("deletes distinct bootstrap xAI collection ids then clears bindings", async () => {
    await clearPerUserXaiHistoryCollectionForUserTenant({
      userIdHex: "507f1f77bcf86cd799439011",
      tenantIdHex: "507f1f77bcf86cd799439022"
    });

    expect(Xai.deleteXaiCollection).toHaveBeenCalledTimes(1);
    expect(Xai.deleteXaiCollection).toHaveBeenCalledWith("col_a");
    expect(updateManyMock).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: "507f1f77bcf86cd799439011",
        tenantId: "507f1f77bcf86cd799439022"
      }),
      expect.objectContaining({
        $unset: { xaiCollectionId: "", xaiCollectionName: "" }
      })
    );
    expect(updateOneMock).toHaveBeenCalledWith(
      { _id: new ObjectId("507f1f77bcf86cd799439011") },
      expect.objectContaining({
        $unset: { xaiCollectionId: "", xaiCollectionName: "" }
      })
    );
  });

  it("skips xAI delete when management key is not configured", async () => {
    vi.mocked(Xai.hasXaiManagementApiKey).mockReturnValue(false);

    await clearPerUserXaiHistoryCollectionForUserTenant({
      userIdHex: "507f1f77bcf86cd799439011",
      tenantIdHex: "507f1f77bcf86cd799439022"
    });

    expect(Xai.deleteXaiCollection).not.toHaveBeenCalled();
    expect(updateManyMock).toHaveBeenCalled();
    expect(updateOneMock).toHaveBeenCalled();
  });

  it("no-ops on invalid user id", async () => {
    await clearPerUserXaiHistoryCollectionForUserTenant({ userIdHex: "not-valid" });
    expect(Xai.deleteXaiCollection).not.toHaveBeenCalled();
    expect(vi.mocked(getDb)).not.toHaveBeenCalled();
  });
});
