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
  respondWithXaiToolLoop: vi.fn(),
  searchDocumentsInCollections: vi.fn()
}));

const repositoryMocks = vi.hoisted(() => ({
  getPersonaById: vi.fn(),
  resolveDefaultXchatPersonaForSession: vi.fn(),
  retrieveRagChunks: vi.fn(),
  saveXChatLog: vi.fn()
}));

const verifierMocks = vi.hoisted(() => ({
  verifyXaiCollectionNonBlocking: vi.fn()
}));

const bootstrapMocks = vi.hoisted(() => ({
  getUserBootstrapCollectionByUserId: vi.fn()
}));

const coreAdminRepositoryMocks = vi.hoisted(() => ({
  getUserAdminSettings: vi.fn()
}));

vi.mock("@/lib/auth", () => authMocks);
vi.mock("@/lib/rate-limit", () => rateLimitMocks);
vi.mock("@/lib/xai", () => xaiMocks);
vi.mock("@/modules/xchat/repository", () => repositoryMocks);
vi.mock("@/modules/xchat/xai-collection-verifier", () => verifierMocks);
vi.mock("@/modules/core-admin/access-request-bootstrap", () => bootstrapMocks);
vi.mock("@/modules/core-admin/repository", () => coreAdminRepositoryMocks);

import { POST as postAsk } from "@/app/api/xchat/ask/route";

function buildPersona(overrides?: Record<string, unknown>) {
  return {
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
    status: "published",
    xapi: {
      mode: "responses",
      toolChoice: "auto",
      maxTurns: 5,
      tools: [{ type: "web_search" }]
    },
    createdAt: new Date("2026-03-16T00:00:00.000Z"),
    updatedAt: new Date("2026-03-16T00:00:00.000Z"),
    ...overrides
  };
}

describe("xchat ask route collection retrieval", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authMocks.requireSessionUser.mockResolvedValue({
      userId: "507f1f77bcf86cd799439011",
      tenantId: "507f1f77bcf86cd799439022",
      email: "admin@atxfinance.ai",
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
    repositoryMocks.resolveDefaultXchatPersonaForSession.mockResolvedValue(buildPersona());
    repositoryMocks.getPersonaById.mockResolvedValue(buildPersona());
    repositoryMocks.retrieveRagChunks.mockResolvedValue([]);
    repositoryMocks.saveXChatLog.mockResolvedValue(undefined);
    xaiMocks.searchDocumentsInCollections.mockResolvedValue([]);
    bootstrapMocks.getUserBootstrapCollectionByUserId.mockResolvedValue({
      collectionId: "collection_user-personal",
      collectionName: "Personal Docs"
    });
    coreAdminRepositoryMocks.getUserAdminSettings.mockResolvedValue(null);
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
    expect(verifierMocks.verifyXaiCollectionNonBlocking).toHaveBeenCalledWith(
      "collection_b75e188e-e7e6-4aa8-8e01-23caf0946236"
    );
    expect(verifierMocks.verifyXaiCollectionNonBlocking).toHaveBeenCalledWith("collection_user-personal");
    expect(xaiMocks.searchDocumentsInCollections).toHaveBeenCalledWith(
      expect.objectContaining({
        collectionIds: [
          "collection_ops-global",
          "collection_b75e188e-e7e6-4aa8-8e01-23caf0946236",
          "collection_user-personal"
        ]
      })
    );
    expect(repositoryMocks.retrieveRagChunks).not.toHaveBeenCalled();
    expect(xaiMocks.respondWithXai).toHaveBeenCalledWith(
      expect.objectContaining({
        systemPrompt: expect.stringContaining("Collection context snippet"),
        toolChoice: "auto",
        maxTurns: 5
      })
    );
    expect(repositoryMocks.saveXChatLog).toHaveBeenCalledWith(
      expect.objectContaining({
        collectionContextReferences: [
          expect.objectContaining({
            documentName: "ops-handbook.md",
            snippetFingerprint: expect.stringMatching(/^f[0-9a-f]{8}$/)
          })
        ]
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
    expect(repositoryMocks.saveXChatLog).toHaveBeenCalledWith(
      expect.objectContaining({
        xapiMode: "responses",
        xapiToolChoice: "auto",
        xapiMaxTurns: 5,
        xapiToolCount: 1,
        contextChunkIds: [expect.any(ObjectId)]
      })
    );
  });

  it("falls back to mongo rag chunks when collection search throws", async () => {
    xaiMocks.searchDocumentsInCollections.mockRejectedValueOnce(new Error("collection unavailable"));
    repositoryMocks.retrieveRagChunks.mockResolvedValueOnce([
      {
        _id: new ObjectId("507f1f77bcf86cd799439109"),
        fileId: new ObjectId("507f1f77bcf86cd799439066"),
        scope: "global",
        chunkIndex: 0,
        text: "Mongo chunk after collection error",
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
          message: "fallback on collection error",
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

  it("uses mongo retrieval when linked collection search has no hits", async () => {
    repositoryMocks.resolveDefaultXchatPersonaForSession.mockResolvedValueOnce(
      buildPersona({
        xaiCollection: {
          collectionId: "",
          collectionName: ""
        }
      })
    );
    repositoryMocks.retrieveRagChunks.mockResolvedValueOnce([
      {
        _id: new ObjectId("507f1f77bcf86cd799439129"),
        fileId: new ObjectId("507f1f77bcf86cd799439066"),
        scope: "global",
        chunkIndex: 0,
        text: "Mongo chunk without collection",
        tokenEstimate: 42,
        createdAt: new Date("2026-03-16T00:00:00.000Z")
      }
    ]);

    const response = await postAsk(
      new Request("http://test/api/xchat/ask", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: "No collection id path",
          topK: 4
        })
      })
    );

    const payload = (await response.json()) as { data: { contextSource: string; contextCount: number } };
    expect(response.status).toBe(200);
    expect(payload.data.contextSource).toBe("mongo_scope");
    expect(payload.data.contextCount).toBe(1);
    expect(xaiMocks.searchDocumentsInCollections).toHaveBeenCalledTimes(1);
    expect(verifierMocks.verifyXaiCollectionNonBlocking).toHaveBeenCalledWith(
      "collection_b75e188e-e7e6-4aa8-8e01-23caf0946236"
    );
    expect(verifierMocks.verifyXaiCollectionNonBlocking).toHaveBeenCalledWith("collection_user-personal");
  });

  it("injects linked collection ids into persona file_search tools", async () => {
    repositoryMocks.resolveDefaultXchatPersonaForSession.mockResolvedValueOnce(
      buildPersona({
        xapi: {
          mode: "responses",
          toolChoice: "auto",
          maxTurns: 5,
          tools: [{ type: "file_search", source: { collection_ids: ["collection_ops-global"] } }]
        }
      })
    );

    const response = await postAsk(
      new Request("http://test/api/xchat/ask", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: "merge linked collection ids into tool"
        })
      })
    );

    expect(response.status).toBe(200);
    expect(xaiMocks.respondWithXai).toHaveBeenCalledWith(
      expect.objectContaining({
        tools: [
          {
            type: "file_search",
            source: {
              collection_ids: [
                "collection_ops-global",
                "collection_b75e188e-e7e6-4aa8-8e01-23caf0946236",
                "collection_user-personal"
              ]
            }
          }
        ]
      })
    );
  });

  it("keeps context empty when rag is disabled", async () => {
    repositoryMocks.resolveDefaultXchatPersonaForSession.mockResolvedValueOnce(
      buildPersona({ enableRag: false })
    );

    const response = await postAsk(
      new Request("http://test/api/xchat/ask", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: "RAG disabled",
          topK: 4
        })
      })
    );

    const payload = (await response.json()) as { data: { contextSource: string; contextCount: number } };
    expect(response.status).toBe(200);
    expect(payload.data.contextSource).toBe("none");
    expect(payload.data.contextCount).toBe(0);
    expect(xaiMocks.searchDocumentsInCollections).not.toHaveBeenCalled();
    expect(repositoryMocks.retrieveRagChunks).not.toHaveBeenCalled();
  });

  it("uses chat completions mode when persona xapi mode is chat_completions", async () => {
    repositoryMocks.resolveDefaultXchatPersonaForSession.mockResolvedValueOnce(
      buildPersona({
        xapi: {
          mode: "chat_completions",
          toolChoice: "auto",
          maxTurns: 5,
          tools: []
        }
      })
    );

    const response = await postAsk(
      new Request("http://test/api/xchat/ask", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: "Use fallback mode",
          topK: 4
        })
      })
    );

    expect(response.status).toBe(200);
    expect(xaiMocks.chatWithXai).toHaveBeenCalledTimes(1);
    expect(xaiMocks.respondWithXai).not.toHaveBeenCalled();
    expect(repositoryMocks.saveXChatLog).toHaveBeenCalledWith(
      expect.objectContaining({
        xapiMode: "chat_completions",
        xapiToolChoice: "auto",
        xapiMaxTurns: 5,
        xapiToolCount: 0
      })
    );
  });

  it("still responds when mongo retrieval throws after collection miss", async () => {
    xaiMocks.searchDocumentsInCollections.mockResolvedValueOnce([]);
    repositoryMocks.retrieveRagChunks.mockRejectedValueOnce(new Error("mongo unavailable"));

    const response = await postAsk(
      new Request("http://test/api/xchat/ask", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          personaId: "507f1f77bcf86cd799439055",
          message: "mongo failure handling",
          topK: 4
        })
      })
    );

    const payload = (await response.json()) as { data: { contextSource: string; contextCount: number } };
    expect(response.status).toBe(200);
    expect(payload.data.contextSource).toBe("none");
    expect(payload.data.contextCount).toBe(0);
  });

  it("returns structured 502 when xai provider call fails", async () => {
    xaiMocks.respondWithXai.mockRejectedValueOnce(new Error("provider outage"));
    xaiMocks.chatWithXai.mockRejectedValue(new Error("provider outage"));

    const response = await postAsk(
      new Request("http://test/api/xchat/ask", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          personaId: "507f1f77bcf86cd799439055",
          message: "provider error path",
          topK: 4
        })
      })
    );
    const payload = (await response.json()) as {
      error: string;
      provider: string;
      retryable: boolean;
    };
    expect(response.status).toBe(502);
    expect(payload).toEqual({
      error: "xAI provider request failed",
      provider: "xai",
      retryable: true
    });
    expect(repositoryMocks.saveXChatLog).not.toHaveBeenCalled();
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

  it("returns 429 when rate limit is exceeded", async () => {
    const resetAtMs = Date.now() + 30_000;
    rateLimitMocks.checkRateLimit.mockReturnValueOnce({
      allowed: false,
      remaining: 0,
      resetAtMs
    });
    const response = await postAsk(
      new Request("http://test/api/xchat/ask", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: "test rate limit" })
      })
    );
    const payload = (await response.json()) as {
      error: string;
      retryAfterSeconds: number;
    };
    expect(response.status).toBe(429);
    expect(payload.error).toBe("Rate limit exceeded");
    expect(payload.retryAfterSeconds).toBeGreaterThan(0);
  });

  it("returns 400 for invalid ask payload", async () => {
    const response = await postAsk(
      new Request("http://test/api/xchat/ask", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: "" })
      })
    );
    expect(response.status).toBe(400);
    const payload = (await response.json()) as { error: string };
    expect(payload.error).toBe("Invalid ask payload");
  });

  it("allows app_user to choose a published persona", async () => {
    authMocks.requireSessionUser.mockResolvedValueOnce({
      userId: "507f1f77bcf86cd799439011",
      tenantId: "507f1f77bcf86cd799439022",
      email: "viewer@atxfinance.ai",
      username: "xf-viewer",
      roles: ["viewer"]
    });
    repositoryMocks.getPersonaById.mockResolvedValueOnce(
      buildPersona({
        _id: new ObjectId("507f1f77bcf86cd799439077"),
        name: "Industry Pro",
        nameNormalized: "industry pro"
      })
    );

    const response = await postAsk(
      new Request("http://test/api/xchat/ask", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          personaId: "507f1f77bcf86cd799439077",
          message: "use selected professional persona"
        })
      })
    );

    expect(response.status).toBe(200);
    expect(repositoryMocks.getPersonaById).toHaveBeenCalledWith("507f1f77bcf86cd799439077");
  });

  it("denies app_user selecting draft persona", async () => {
    authMocks.requireSessionUser.mockResolvedValueOnce({
      userId: "507f1f77bcf86cd799439011",
      tenantId: "507f1f77bcf86cd799439022",
      email: "viewer@atxfinance.ai",
      username: "xf-viewer",
      roles: ["viewer"]
    });
    repositoryMocks.getPersonaById.mockResolvedValueOnce(
      buildPersona({
        status: "draft"
      })
    );

    const response = await postAsk(
      new Request("http://test/api/xchat/ask", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          personaId: "507f1f77bcf86cd799439055",
          message: "deny draft persona"
        })
      })
    );
    const payload = (await response.json()) as { error: string; code: string };

    expect(response.status).toBe(403);
    expect(payload.code).toBe("persona_not_allowed");
    expect(xaiMocks.respondWithXai).not.toHaveBeenCalled();
  });

  it("denies app_user model override request", async () => {
    authMocks.requireSessionUser.mockResolvedValueOnce({
      userId: "507f1f77bcf86cd799439011",
      tenantId: "507f1f77bcf86cd799439022",
      email: "viewer@atxfinance.ai",
      username: "xf-viewer",
      roles: ["viewer"]
    });

    const response = await postAsk(
      new Request("http://test/api/xchat/ask", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: "model override should fail",
          model: "grok-4.20-multi-agent"
        })
      })
    );
    const payload = (await response.json()) as { error: string; code: string };

    expect(response.status).toBe(403);
    expect(payload.code).toBe("model_override_not_allowed");
    expect(xaiMocks.respondWithXai).not.toHaveBeenCalled();
  });

  it("maps multi-agent effort high to 16 agents for admin override", async () => {
    const response = await postAsk(
      new Request("http://test/api/xchat/ask", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: "run multi-agent",
          model: "grok-4.20-multi-agent",
          reasoningEffort: "high"
        })
      })
    );

    expect(response.status).toBe(200);
    expect(xaiMocks.respondWithXai).toHaveBeenCalledWith(
      expect.objectContaining({
        model: "grok-4.20-multi-agent",
        parallelism: {
          agentCount: 16,
          reasoningEffort: "high"
        }
      })
    );
  });

  it("rejects reasoningEffort when model is not multi-agent", async () => {
    const response = await postAsk(
      new Request("http://test/api/xchat/ask", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: "invalid effort usage",
          reasoningEffort: "low"
        })
      })
    );
    const payload = (await response.json()) as { error: string; code: string };

    expect(response.status).toBe(400);
    expect(payload.code).toBe("invalid_reasoning_effort");
    expect(xaiMocks.respondWithXai).not.toHaveBeenCalled();
  });
});
