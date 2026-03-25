import { describe, expect, it, vi } from "vitest";

/**
 * Regression: MongoDB rejects upsert when the same path appears in both `$set` and `$setOnInsert`
 * (error 40: conflict at 'singletonKey').
 */
describe("xchat platform settings upsert payload shape", () => {
  it("does not put singletonKey in $set alongside $setOnInsert", async () => {
    const updateOne = vi.fn().mockResolvedValue({ matchedCount: 1, modifiedCount: 1, upsertedCount: 0 });
    const findOne = vi.fn().mockResolvedValue({
      singletonKey: "default" as const,
      defaultAppUserPersonaId: "507f1f77bcf86cd799439055",
      updatedAt: new Date(),
      updatedByUserId: "u1"
    });

    vi.doMock("@/lib/mongodb", () => ({
      getDb: vi.fn().mockResolvedValue({
        collection: () => ({ updateOne, findOne, createIndex: vi.fn().mockResolvedValue(undefined) })
      })
    }));

    const { upsertXchatPlatformSettings } = await import("@/modules/xchat/xchat-platform-settings");
    await upsertXchatPlatformSettings({
      defaultAppUserPersonaId: "507f1f77bcf86cd799439055",
      actorUserId: "u1"
    });

    expect(updateOne).toHaveBeenCalledWith(
      { singletonKey: "default" },
      {
        $set: expect.not.objectContaining({ singletonKey: expect.anything() }) as Record<string, unknown>,
        $setOnInsert: { singletonKey: "default" }
      },
      { upsert: true }
    );

    const payload = updateOne.mock.calls[0]?.[1] as { $set: Record<string, unknown> };
    expect(payload.$set).not.toHaveProperty("singletonKey");
    expect(payload.$set.updatedAt).toBeInstanceOf(Date);
    vi.unmock("@/lib/mongodb");
  });
});
