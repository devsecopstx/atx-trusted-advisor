import { ObjectId } from "mongodb";
import { beforeEach, describe, expect, it, vi } from "vitest";

const hoistedGetDb = vi.hoisted(() => vi.fn());

vi.mock("@/lib/mongodb", () => ({
  getDb: hoistedGetDb
}));

import { saveXChatLog } from "@/modules/xchat/repository";
import type { SaveXChatLogInput } from "@/modules/xchat/types";

describe("saveXChatLog + usage stats side-effect", () => {
  let logsInsertOne: ReturnType<typeof vi.fn>;
  let statsUpdateOne: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    logsInsertOne = vi.fn().mockResolvedValue({ insertedId: new ObjectId() });
    statsUpdateOne = vi.fn().mockResolvedValue({ modifiedCount: 1, upsertedCount: 1 });

    hoistedGetDb.mockImplementation(async () => ({
      collection: (name: string) => {
        if (name === "xchat_logs") {
          return {
            createIndex: vi.fn().mockResolvedValue("idx"),
            insertOne: logsInsertOne
          };
        }
        if (name === "xchat_user_usage_stats") {
          return {
            createIndex: vi.fn().mockResolvedValue("idx"),
            updateOne: statsUpdateOne
          };
        }
        return {
          createIndex: vi.fn().mockResolvedValue("idx")
        };
      }
    }));
  });

  function makeValidPayload(overrides: Partial<SaveXChatLogInput> = {}): SaveXChatLogInput {
    const userId = new ObjectId("507f1f77bcf86cd799439011");
    const tenantId = new ObjectId("507f1f77bcf86cd799439022");
    return {
      threadId: "thread-abc",
      requestId: "req-123",
      correlationId: "corr-456",
      userId,
      tenantId,
      userEmail: "user@example.com",
      requestedBy: "tester",
      personaId: new ObjectId(),
      personaName: "Advisor",
      scope: "general",
      message: "What is the market doing?",
      response: "The market is up 1.2% today.",
      contextChunkIds: [],
      model: "grok-4-1-fast-reasoning",
      xaiUsage: { inputTokens: 900, outputTokens: 350, totalTokens: 1250 },
      createdAt: new Date(), // will be overwritten inside saveXChatLog
      ...overrides
    } as SaveXChatLogInput;
  }

  it("persists the turn to xchat_logs and upserts usage stats for the user+tenant", async () => {
    const payload = makeValidPayload();
    const insertedId = await saveXChatLog(payload);

    expect(insertedId).toBeInstanceOf(ObjectId);

    // Logs insert happened
    expect(logsInsertOne).toHaveBeenCalledTimes(1);
    const insertArg = logsInsertOne.mock.calls[0][0];
    expect(insertArg.userId).toEqual(payload.userId);
    expect(insertArg.message).toBe(payload.message);
    expect(insertArg.xaiUsage?.totalTokens).toBe(1250);

    // Stats upsert happened (fire-and-forget, but mock should have been called)
    // Give the .catch() microtask a chance to run
    await Promise.resolve();

    expect(statsUpdateOne).toHaveBeenCalledTimes(1);
    const [query, update, options] = statsUpdateOne.mock.calls[0];
    expect(query).toEqual({ userId: payload.userId, tenantId: payload.tenantId ?? null });
    expect(update.$inc.totalTokens).toBe(1250);
    expect(update.$inc.promptCount).toBe(1);
    expect(update.$setOnInsert.userId).toEqual(payload.userId);
    expect(options).toEqual({ upsert: true });
  });

  it("still works (and calls stats upsert) when tenantId is null", async () => {
    const payload = makeValidPayload({ tenantId: null });
    await saveXChatLog(payload);

    await Promise.resolve();

    expect(statsUpdateOne).toHaveBeenCalledWith(
      { userId: payload.userId, tenantId: null },
      expect.any(Object),
      { upsert: true }
    );
  });

  it("omits optional fields gracefully and still records tokens", async () => {
    const payload = makeValidPayload({
      threadId: undefined,
      personaName: undefined,
      xaiUsage: { inputTokens: 30, outputTokens: 12, totalTokens: 42 }
    });

    await saveXChatLog(payload);
    await Promise.resolve();

    const insertArg = logsInsertOne.mock.calls[0][0];
    expect(insertArg.threadId).toBeUndefined();
    expect(statsUpdateOne).toHaveBeenCalled();
    expect(statsUpdateOne.mock.calls[0][1].$inc.totalTokens).toBe(42);
  });
});
