import { ObjectId } from "mongodb";
import { NextResponse } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const authMocks = vi.hoisted(() => ({
  requireSessionUser: vi.fn()
}));

const rateLimitMocks = vi.hoisted(() => ({
  checkRateLimit: vi.fn()
}));

const xaiMocks = vi.hoisted(() => ({
  chatWithXai: vi.fn(),
  respondWithXai: vi.fn(),
  searchDocumentsInCollections: vi.fn()
}));

const repositoryMocks = vi.hoisted(() => ({
  getPersonaById: vi.fn(),
  retrieveRagChunks: vi.fn(),
  saveXChatLog: vi.fn()
}));

const verifierMocks = vi.hoisted(() => ({
  verifyXaiCollectionNonBlocking: vi.fn()
}));

vi.mock("@/lib/auth", () => authMocks);
vi.mock("@/lib/rate-limit", () => rateLimitMocks);
vi.mock("@/lib/xai", () => xaiMocks);
vi.mock("@/modules/xchat/repository", () => repositoryMocks);
vi.mock("@/modules/xchat/xai-collection-verifier", () => verifierMocks);

import { POST as postAsk } from "@/app/api/xchat/ask/route";

describe("xchat ask route collection retrieval", () => {
  beforeEach(() => {
    authMocks.requireSessionUser.mockResolvedValue({
      userId: "507f1f77bcf86cd799439011",
      tenantId: "507f1f77bcf86cd799439022",
      email: "admin@xfinance.ai",
      username: "xf-admin",
      roles: ["global_admin"]
    });
    rateLimitMocks.checkRateLimit.mockReturnValue({
      allowed: true,
      resetAtMs: Date.now() + 60_000
    });
    xaiMocks.chatWithXai.mockResolvedValue({
      outputText: "xAI answer",
      model: "grok-4-latest"
    });
    xaiMocks.respondWithXai.mockResolvedValue({
      outputText: "xAI answer",
      model: "grok-4-latest"
    });
    repositoryMocks.getPersonaById.mockResolvedValue({
      _id: new ObjectId("507f1f77bcf86cd799439055"),
      name: "Ops",
      nameNormalized: "ops",
      systemPrompt: "You are ops.",
      overridePrompt: "Use checklist output.",
      xaiCollection: {
        collectionId: "collection_ops-global",
        collectionName: "Ops Docs"
      },
      model: "grok-4-latest",
      temperature: 0.2,
      enableRag: true,
      defaultScope: "global",
      xapi: {
        mode: "responses",
        toolChoice: "auto",
        maxTurns: 5,
        tools: [{ type: "web_search" }]
      },
      createdAt: new Date("2026-03-16T00:00:00.000Z"),
      updatedAt: new Date("2026-03-16T00:00:00.000Z")
    });
    repositoryMocks.retrieveRagChunks.mockResolvedValue([]);
    repositoryMocks.saveXChatLog.mockResolvedValue(undefined);
    xaiMocks.searchDocumentsInCollections.mockResolvedValue([]);
    verifierMocks.verifyXaiCollectionNonBlocking.mockImplementation(() => {});
  });

  it("uses xai collection snippets first when available", async () => {
    xaiMocks.searchDocumentsInCollections.mockResolvedValueOnce([
      { text: "Collection context snippet", documentName: "ops-handbook.md" }
    ]);

    const response = await postAsk(
      new Request("http://test/api/xchat/ask", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          personaId: "507f1f77bcf86cd799439055",
          message: "How do we run daily controls?",
          topK: 4
        })
      })
    );

    const payload = (await response.json()) as { data: { contextSource: string; contextCount: number } };
    expect(response.status).toBe(200);
    expect(payload.data.contextSource).toBe("xai_collection");
    expect(payload.data.contextCount).toBe(1);
    expect(verifierMocks.verifyXaiCollectionNonBlocking).toHaveBeenCalledWith("collection_ops-global");
    expect(repositoryMocks.retrieveRagChunks).not.toHaveBeenCalled();
    expect(xaiMocks.respondWithXai).toHaveBeenCalledWith(
      expect.objectContaining({
        systemPrompt: expect.stringContaining("Collection context snippet"),
        toolChoice: "auto",
        maxTurns: 5
      })
    );
  });

  it("falls back to mongo rag chunks when collection search returns empty", async () => {
    repositoryMocks.retrieveRagChunks.mockResolvedValueOnce([
      {
        _id: new ObjectId("507f1f77bcf86cd799439099"),
        fileId: new ObjectId("507f1f77bcf86cd799439066"),
        scope: "global",
        chunkIndex: 0,
        text: "Mongo fallback chunk",
        tokenEstimate: 42,
        createdAt: new Date("2026-03-16T00:00:00.000Z")
      }
    ]);

    const response = await postAsk(
      new Request("http://test/api/xchat/ask", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          personaId: "507f1f77bcf86cd799439055",
          message: "Fallback path?",
          topK: 4
        })
      })
    );

    const payload = (await response.json()) as { data: { contextSource: string; contextCount: number } };
    expect(response.status).toBe(200);
    expect(payload.data.contextSource).toBe("mongo_scope");
    expect(payload.data.contextCount).toBe(1);
    expect(repositoryMocks.retrieveRagChunks).toHaveBeenCalledTimes(1);
  });

  it("uses chat completions mode when persona xapi mode is chat_completions", async () => {
    repositoryMocks.getPersonaById.mockResolvedValueOnce({
      _id: new ObjectId("507f1f77bcf86cd799439055"),
      name: "Ops",
      nameNormalized: "ops",
      systemPrompt: "You are ops.",
      overridePrompt: "Use checklist output.",
      xaiCollection: {
        collectionId: "collection_ops-global",
        collectionName: "Ops Docs"
      },
      model: "grok-4-latest",
      temperature: 0.2,
      enableRag: true,
      defaultScope: "global",
      xapi: {
        mode: "chat_completions",
        toolChoice: "auto",
        maxTurns: 5,
        tools: []
      },
      createdAt: new Date("2026-03-16T00:00:00.000Z"),
      updatedAt: new Date("2026-03-16T00:00:00.000Z")
    });

    const response = await postAsk(
      new Request("http://test/api/xchat/ask", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          personaId: "507f1f77bcf86cd799439055",
          message: "Use fallback mode",
          topK: 4
        })
      })
    );

    expect(response.status).toBe(200);
    expect(xaiMocks.chatWithXai).toHaveBeenCalledTimes(1);
    expect(xaiMocks.respondWithXai).not.toHaveBeenCalled();
  });

  it("continues when unauthenticated by returning auth response", async () => {
    authMocks.requireSessionUser.mockResolvedValueOnce(
      NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    );
    const response = await postAsk(
      new Request("http://test/api/xchat/ask", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: "test" })
      })
    );
    expect(response.status).toBe(401);
  });
});
