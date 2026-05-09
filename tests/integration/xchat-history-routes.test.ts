import { NextResponse } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const authMocks = vi.hoisted(() => ({
  requireSessionUser: vi.fn()
}));

const repositoryMocks = vi.hoisted(() => ({
  listXChatHistoryByUser: vi.fn(),
  listXChatThreadsByUser: vi.fn(),
  deleteXChatHistoryByUser: vi.fn(),
  getXChatHistoryStatsByUser: vi.fn(),
  resolveDefaultXchatPersonaForSession: vi.fn()
}));

const identityMocks = vi.hoisted(() => ({
  getTenantByHexId: vi.fn()
}));

const prefsMocks = vi.hoisted(() => ({
  getXchatUserPreferences: vi.fn()
}));

vi.mock("@/lib/auth", () => authMocks);
vi.mock("@/modules/identity/repository", () => ({
  getTenantByHexId: identityMocks.getTenantByHexId
}));
vi.mock("@/modules/xchat/repository", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/modules/xchat/repository")>();
  return { ...actual, ...repositoryMocks };
});
vi.mock("@/modules/xchat/user-preferences-repository", () => prefsMocks);

import { DELETE as deleteHistory, GET as getHistory } from "@/app/api/xchat/history/route";
import { GET as getHistoryStats } from "@/app/api/xchat/history/stats/route";
import { GET as getThreads } from "@/app/api/xchat/threads/route";

describe("xchat history routes", () => {
  beforeEach(() => {
    identityMocks.getTenantByHexId.mockResolvedValue({
      tenantPreferences: {}
    });
    authMocks.requireSessionUser.mockResolvedValue({
      userId: "507f1f77bcf86cd799439011",
      email: "viewer@atxfinance.ai",
      username: "viewer",
      roles: ["viewer"],
      tenantId: "507f1f77bcf86cd799439022",
      tenantRole: "member"
    });
    repositoryMocks.listXChatHistoryByUser.mockResolvedValue([
      {
        id: "507f1f77bcf86cd799439055",
        message: "How can I hedge TSLA?",
        response: "Use protective puts for downside control.",
        model: "grok-4-1-fast-reasoning",
        createdAt: new Date("2026-03-20T12:00:00.000Z"),
        contextReferenceCount: 2,
        toolCallCount: 1
      }
    ]);
    repositoryMocks.getXChatHistoryStatsByUser.mockResolvedValue({
      totalPrompts: 19,
      activeDays: 4,
      referencedFileCount: 7,
      lastPromptAt: new Date("2026-03-20T12:00:00.000Z")
    });
    repositoryMocks.deleteXChatHistoryByUser.mockResolvedValue(3);
    repositoryMocks.listXChatThreadsByUser.mockResolvedValue([
      {
        threadId: "thread-hnwi-1",
        title: "Wheel overlay for NVDA",
        lastMessageAt: new Date("2026-03-20T12:00:00.000Z"),
        turnCount: 5,
        lastMessage: "wheel overlay refresh"
      }
    ]);
    repositoryMocks.resolveDefaultXchatPersonaForSession.mockResolvedValue({
      xaiCollection: { collectionId: "collection_b75e188e-e7e6-4aa8-8e01-23caf0946236" }
    });
    prefsMocks.getXchatUserPreferences.mockResolvedValue({
      keepLastTenMessages: true
    });
  });

  it("lists history with pagination metadata", async () => {
    const response = await getHistory(
      new Request("http://127.0.0.1/api/xchat/history?limit=10")
    );

    expect(response.status).toBe(200);
    const payload = (await response.json()) as {
      data: { items: Array<{ createdAt: string }>; hasMore: boolean };
    };
    expect(payload.data.items.length).toBe(1);
    expect(payload.data.items[0].createdAt).toContain("2026-03-20T12:00:00.000Z");
    expect(payload.data.hasMore).toBe(false);
  });

  it("returns stats with collection id context", async () => {
    const response = await getHistoryStats();

    expect(response.status).toBe(200);
    const payload = (await response.json()) as {
      data: { totalPrompts: number; collectionId: string | null; historyMode: string };
    };
    expect(payload.data.totalPrompts).toBe(19);
    expect(payload.data.collectionId).toContain("collection_b75e188e");
    expect(payload.data.historyMode).toBe("mongo");
  });

  it("returns ephemeral mode when keep-last-10 is disabled", async () => {
    prefsMocks.getXchatUserPreferences.mockResolvedValueOnce({
      keepLastTenMessages: false
    });
    const response = await getHistoryStats();
    expect(response.status).toBe(200);
    const payload = (await response.json()) as { data: { historyMode: string } };
    expect(payload.data.historyMode).toBe("ephemeral");
  });

  it("returns auth response when unauthenticated", async () => {
    authMocks.requireSessionUser.mockResolvedValueOnce(
      NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    );

    const response = await getHistory(new Request("http://127.0.0.1/api/xchat/history"));
    expect(response.status).toBe(401);
  });

  it("accepts cursorId and forwards tie-break cursor to repository", async () => {
    const response = await getHistory(
      new Request(
        "http://127.0.0.1/api/xchat/history?limit=10&cursor=2026-03-20T12:00:00.000Z&cursorId=507f1f77bcf86cd799439055"
      )
    );

    expect(response.status).toBe(200);
    expect(repositoryMocks.listXChatHistoryByUser).toHaveBeenCalledWith(
      expect.objectContaining({
        before: new Date("2026-03-20T12:00:00.000Z"),
        beforeId: expect.objectContaining({
          toHexString: expect.any(Function)
        })
      })
    );
  });

  it("forwards threadId filter to repository", async () => {
    const response = await getHistory(
      new Request("http://127.0.0.1/api/xchat/history?limit=10&threadId=thread-hnwi-1")
    );
    expect(response.status).toBe(200);
    expect(repositoryMocks.listXChatHistoryByUser).toHaveBeenCalledWith(
      expect.objectContaining({
        threadId: "thread-hnwi-1"
      })
    );
  });

  it("returns 400 for invalid cursorId", async () => {
    const response = await getHistory(
      new Request(
        "http://127.0.0.1/api/xchat/history?limit=10&cursor=2026-03-20T12:00:00.000Z&cursorId=not-an-objectid"
      )
    );
    expect(response.status).toBe(400);
  });

  it("deletes history for current user", async () => {
    const response = await deleteHistory(new Request("http://127.0.0.1/api/xchat/history"));
    expect(response.status).toBe(200);
    const payload = (await response.json()) as { data: { ok: boolean; deletedCount: number } };
    expect(payload.data.ok).toBe(true);
    expect(payload.data.deletedCount).toBe(3);
    expect(repositoryMocks.deleteXChatHistoryByUser).toHaveBeenCalled();
  });

  it("lists thread summaries newest-first", async () => {
    const response = await getThreads(
      new Request("http://127.0.0.1/api/xchat/threads?limit=10")
    );
    expect(response.status).toBe(200);
    const payload = (await response.json()) as {
      data: {
        items: Array<{ threadId: string; title: string; turnCount: number; lastMessageAt: string }>;
      };
    };
    expect(payload.data.items[0]?.threadId).toBe("thread-hnwi-1");
    expect(payload.data.items[0]?.title).toContain("Wheel overlay");
    expect(payload.data.items[0]?.turnCount).toBe(5);
    expect(payload.data.items[0]?.lastMessageAt).toContain("2026-03-20T12:00:00.000Z");
  });
});
