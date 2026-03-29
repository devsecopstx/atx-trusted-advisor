import { ObjectId } from "mongodb";
import { NextResponse } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const authMocks = vi.hoisted(() => ({
  requireSessionUser: vi.fn()
}));

const usageLimitMocks = vi.hoisted(() => ({
  enforceDistributedAskUsageLimit: vi.fn()
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
  listXChatHistoryByUser: vi.fn(),
  saveXChatLog: vi.fn()
}));

const teamKbMocks = vi.hoisted(() => ({
  resolveTeamKbCollectionId: vi.fn()
}));

const verifierMocks = vi.hoisted(() => ({
  verifyXaiCollectionNonBlocking: vi.fn()
}));

const coreAdminRepositoryMocks = vi.hoisted(() => ({
  getUserAdminSettings: vi.fn()
}));

const ragReadinessMocks = vi.hoisted(() => ({
  getScopeReadinessSummary: vi.fn()
}));

const auditMocks = vi.hoisted(() => ({
  createAuditEvent: vi.fn()
}));

const defaultWorkspaceLimits = {
  userXoptionsLimit: 10,
  userChatLimit: 10,
  tenantPortfolioLimit: 1,
  portfolioAccountLimit: 1
};

const identityMocks = vi.hoisted(() => ({
  getCoreUserById: vi.fn(),
  getTenantByHexId: vi.fn(),
  resolvedWorkspaceLimitsForTenant: vi.fn()
}));

const workspaceSnapshotMocks = vi.hoisted(() => ({
  buildWorkspaceServerSnapshotBlock: vi.fn()
}));

vi.mock("@/lib/auth", () => authMocks);
vi.mock("@/lib/xai", () => xaiMocks);
vi.mock("@/modules/xchat/ask-usage-limits", () => usageLimitMocks);
vi.mock("@/modules/xchat/repository", () => repositoryMocks);
vi.mock("@/modules/xchat/team-xai-collection", () => teamKbMocks);
vi.mock("@/modules/xchat/xai-collection-verifier", () => verifierMocks);
vi.mock("@/modules/core-admin/repository", () => coreAdminRepositoryMocks);
vi.mock("@/modules/xchat/rag-file-readiness", () => ragReadinessMocks);
vi.mock("@/modules/audit/repository", () => auditMocks);
vi.mock("@/modules/identity/repository", () => identityMocks);
vi.mock("@/modules/xchat/workspace-snapshot-for-prompt", () => workspaceSnapshotMocks);

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
    usageLimitMocks.enforceDistributedAskUsageLimit.mockResolvedValue({
      allowed: true,
      remainingMinute: 19
    });
    xaiMocks.chatWithXai.mockResolvedValue({
      outputText: "xAI answer",
      model: "grok-4-latest"
    });
    xaiMocks.respondWithXai.mockResolvedValue({
      outputText: "xAI answer",
      model: "grok-4-latest"
    });
    xaiMocks.respondWithXaiToolLoop.mockResolvedValue({
      outputText: "xAI answer",
      model: "grok-4-latest",
      toolCalls: [],
      turnsUsed: 1,
      raw: {}
    });
    teamKbMocks.resolveTeamKbCollectionId.mockResolvedValue("collection_team_default");
    repositoryMocks.resolveDefaultXchatPersonaForSession.mockResolvedValue(buildPersona());
    repositoryMocks.getPersonaById.mockResolvedValue(buildPersona());
    repositoryMocks.listXChatHistoryByUser.mockResolvedValue([]);
    repositoryMocks.saveXChatLog.mockResolvedValue(new ObjectId("507f1f77bcf86cd799439099"));
    xaiMocks.searchDocumentsInCollections.mockResolvedValue([]);
    auditMocks.createAuditEvent.mockResolvedValue(undefined);
    identityMocks.getCoreUserById.mockResolvedValue(null);
    identityMocks.getTenantByHexId.mockResolvedValue(null);
    identityMocks.resolvedWorkspaceLimitsForTenant.mockReturnValue(defaultWorkspaceLimits);
    coreAdminRepositoryMocks.getUserAdminSettings.mockResolvedValue(null);
    verifierMocks.verifyXaiCollectionNonBlocking.mockImplementation(() => {});
    ragReadinessMocks.getScopeReadinessSummary.mockResolvedValue({
      blocked: false,
      nonReadyFiles: []
    });
    workspaceSnapshotMocks.buildWorkspaceServerSnapshotBlock.mockResolvedValue(null);
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
    expect(response.headers.get("x-xchat-limit-remaining-minute")).toBe("19");
    expect(payload.data.contextSource).toBe("xai_collection");
    expect(payload.data.contextCount).toBe(1);
    expect(verifierMocks.verifyXaiCollectionNonBlocking).toHaveBeenCalledWith("collection_team_default");
    expect(verifierMocks.verifyXaiCollectionNonBlocking).toHaveBeenCalledTimes(1);
    expect(xaiMocks.searchDocumentsInCollections).toHaveBeenCalledWith(
      expect.objectContaining({
        collectionIds: ["collection_team_default"]
      })
    );
    expect(repositoryMocks.listXChatHistoryByUser).toHaveBeenCalled();
    expect(xaiMocks.respondWithXaiToolLoop).toHaveBeenCalledWith(
      expect.objectContaining({
        systemPrompt: expect.stringContaining("Collection context snippet"),
        toolChoice: "auto",
        maxTurns: 5,
        tools: expect.arrayContaining([
          { type: "web_search", name: "web_search" },
          { type: "x_search", name: "x_search" }
        ]),
        userPrompt: expect.stringMatching(
          /\[Persona \/ KB metadata — xChat and batch[\s\S]*xChat TEAM KB xAI collection ids[\s\S]*collection_team_default[\s\S]*Persona xAPI tools[\s\S]*- web_search/
        )
      })
    );
    expect(xaiMocks.respondWithXai).not.toHaveBeenCalled();
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
    expect(auditMocks.createAuditEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        entityType: "xchat_session",
        action: "xchat_turn_pending_xai_sync"
      })
    );
  });

  it("uses no RAG context when TEAM collection search returns empty (no mongo fallback)", async () => {
    xaiMocks.searchDocumentsInCollections.mockResolvedValueOnce([]);

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
    expect(payload.data.contextSource).toBe("none");
    expect(payload.data.contextCount).toBe(0);
    const savedLogInput = repositoryMocks.saveXChatLog.mock.calls.at(-1)?.[0] as {
      xapiMode?: string;
      xapiToolChoice?: string;
      xapiMaxTurns?: number;
      xapiToolCount?: number;
      contextChunkIds?: Array<ObjectId | string>;
    };
    expect(savedLogInput?.xapiMode).toBe("responses");
    expect(savedLogInput?.xapiToolChoice).toBe("auto");
    expect(savedLogInput?.xapiMaxTurns).toBe(5);
    expect(savedLogInput?.xapiToolCount).toBe(2);
    expect(savedLogInput?.contextChunkIds ?? []).toEqual([]);
  });

  it("uses no RAG when TEAM collection search throws (no mongo fallback)", async () => {
    xaiMocks.searchDocumentsInCollections.mockRejectedValueOnce(new Error("collection unavailable"));

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
    expect(payload.data.contextSource).toBe("none");
    expect(payload.data.contextCount).toBe(0);
  });

  it("skips xAI collection search when no TEAM kb ids resolve", async () => {
    teamKbMocks.resolveTeamKbCollectionId.mockResolvedValueOnce(undefined);
    repositoryMocks.resolveDefaultXchatPersonaForSession.mockResolvedValueOnce(
      buildPersona({
        teamCollection: { collectionId: "", collectionName: "" },
        xaiCollection: {
          collectionId: "collection_persona_only_ignored_for_ask",
          collectionName: "Ignored for ask RAG"
        }
      })
    );

    const response = await postAsk(
      new Request("http://test/api/xchat/ask", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: "No team kb path",
          topK: 4
        })
      })
    );

    const payload = (await response.json()) as { data: { contextSource: string; contextCount: number } };
    expect(response.status).toBe(200);
    expect(payload.data.contextSource).toBe("none");
    expect(payload.data.contextCount).toBe(0);
    expect(xaiMocks.searchDocumentsInCollections).not.toHaveBeenCalled();
    expect(verifierMocks.verifyXaiCollectionNonBlocking).not.toHaveBeenCalled();
  });

  it("merges persona-declared collection ids into file_search tools for xAI", async () => {
    repositoryMocks.resolveDefaultXchatPersonaForSession.mockResolvedValueOnce(
      buildPersona({
        xapi: {
          mode: "responses",
          toolChoice: "auto",
          maxTurns: 5,
          tools: [{ type: "file_search", source: { collection_ids: ["collection_extra"] } }]
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
    expect(xaiMocks.respondWithXaiToolLoop).toHaveBeenCalledWith(
      expect.objectContaining({
        tools: expect.arrayContaining([
          {
            type: "file_search",
            name: "file_search",
            vector_store_ids: expect.arrayContaining(["collection_team_default", "collection_extra"])
          }
        ])
      })
    );
    expect(xaiMocks.respondWithXai).not.toHaveBeenCalled();
  });

  it("wires hybrid hosted tools for ask (collections_search + web_search/x_search)", async () => {
    repositoryMocks.resolveDefaultXchatPersonaForSession.mockResolvedValueOnce(
      buildPersona({
        xapi: {
          mode: "responses",
          toolChoice: "auto",
          maxTurns: 5,
          tools: [
            { type: "collections_search", collection_ids: ["collection_extra"] },
            { type: "web_search" },
            { type: "x_search" }
          ]
        }
      })
    );

    const response = await postAsk(
      new Request("http://test/api/xchat/ask", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: "hybrid hosted tools wiring"
        })
      })
    );

    expect(response.status).toBe(200);
    expect(xaiMocks.respondWithXaiToolLoop).toHaveBeenCalledWith(
      expect.objectContaining({
        tools: expect.arrayContaining([
          {
            type: "file_search",
            name: "file_search",
            vector_store_ids: expect.arrayContaining(["collection_team_default", "collection_extra"])
          },
          { type: "web_search", name: "web_search" },
          { type: "x_search", name: "x_search" }
        ])
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
  });

  it("uses responses tool loop when persona mode is chat_completions but yahoo_finance requires local execution", async () => {
    repositoryMocks.resolveDefaultXchatPersonaForSession.mockResolvedValueOnce(
      buildPersona({
        xapi: {
          mode: "chat_completions",
          toolChoice: "auto",
          maxTurns: 5,
          tools: [{ type: "yahoo_finance" }]
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
    expect(xaiMocks.respondWithXaiToolLoop).toHaveBeenCalledTimes(1);
    expect(xaiMocks.chatWithXai).not.toHaveBeenCalled();
    expect(xaiMocks.respondWithXai).not.toHaveBeenCalled();
    expect(repositoryMocks.saveXChatLog).toHaveBeenCalledWith(
      expect.objectContaining({
        xapiMode: "chat_completions",
        xapiToolChoice: "auto",
        xapiMaxTurns: 5,
        xapiToolCount: 3
      })
    );
  });

  it("still responds when TEAM collection search misses", async () => {
    xaiMocks.searchDocumentsInCollections.mockResolvedValueOnce([]);

    const response = await postAsk(
      new Request("http://test/api/xchat/ask", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          personaId: "507f1f77bcf86cd799439055",
          message: "empty team rag",
          topK: 4
        })
      })
    );

    const payload = (await response.json()) as { data: { contextSource: string; contextCount: number } };
    expect(response.status).toBe(200);
    expect(payload.data.contextSource).toBe("none");
    expect(payload.data.contextCount).toBe(0);
  });

  it("blocks collection search when embeddings are not ready and labels response", async () => {
    ragReadinessMocks.getScopeReadinessSummary.mockResolvedValueOnce({
      blocked: true,
      nonReadyFiles: [
        {
          fileId: "507f1f77bcf86cd799439199",
          xaiFileId: "file_pending",
          readiness: "pending_embeddings",
          processingStatus: "pending",
          checkedAt: "2026-03-20T00:00:00.000Z"
        }
      ]
    });
    const response = await postAsk(
      new Request("http://test/api/xchat/ask", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          personaId: "507f1f77bcf86cd799439055",
          message: "Should use fallback while indexing",
          topK: 4
        })
      })
    );
    const payload = (await response.json()) as {
      data: {
        contextSource: string;
        collectionSearchStatus: string;
        collectionSearchNonReadyFileCount: number;
      };
    };

    expect(response.status).toBe(200);
    expect(payload.data.contextSource).toBe("none");
    expect(payload.data.collectionSearchStatus).toBe("blocked_non_ready_files");
    expect(payload.data.collectionSearchNonReadyFileCount).toBe(1);
    expect(xaiMocks.searchDocumentsInCollections).not.toHaveBeenCalled();
  });

  it("returns structured 502 when xai provider call fails", async () => {
    xaiMocks.respondWithXaiToolLoop.mockRejectedValueOnce(new Error("provider outage"));
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
      details?: string;
    };
    expect(response.status).toBe(502);
    expect(payload.error).toBe("xAI provider request failed");
    expect(payload.provider).toBe("xai");
    expect(payload.retryable).toBe(true);
    expect(payload.details).toContain("provider outage");
    expect(repositoryMocks.saveXChatLog).not.toHaveBeenCalled();
  });

  it("records pending xAI sync audit after successful ask", async () => {
    const response = await postAsk(
      new Request("http://test/api/xchat/ask", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: "pending sync audit path"
        })
      })
    );
    expect(response.status).toBe(200);
    expect(auditMocks.createAuditEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        entityType: "xchat_session",
        action: "xchat_turn_pending_xai_sync"
      })
    );
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
    usageLimitMocks.enforceDistributedAskUsageLimit.mockResolvedValueOnce({
      allowed: false,
      code: "xchat_rate_limit_exceeded",
      remainingMinute: 0,
      retryAfterSeconds: 30
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
    expect(response.headers.get("x-xchat-limit-remaining-minute")).toBe("0");
    expect(response.headers.get("retry-after")).toBe("30");
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

  it("does not inject atxfinance for app_user when persona omits it", async () => {
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
        nameNormalized: "industry pro",
        xapi: {
          mode: "responses",
          toolChoice: "auto",
          maxTurns: 5,
          tools: [{ type: "web_search" }]
        }
      })
    );

    const response = await postAsk(
      new Request("http://test/api/xchat/ask", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          personaId: "507f1f77bcf86cd799439077",
          message: "what is in my portfolio"
        })
      })
    );

    expect(response.status).toBe(200);
    expect(xaiMocks.respondWithXai).not.toHaveBeenCalled();
    expect(xaiMocks.respondWithXaiToolLoop).toHaveBeenCalled();
    const toolLoopArg = xaiMocks.respondWithXaiToolLoop.mock.calls[0]?.[0] as {
      systemPrompt?: string;
    };
    expect(toolLoopArg?.systemPrompt ?? "").not.toContain("You MUST use the atxfinance tool");
    expect(toolLoopArg?.systemPrompt ?? "").toContain("Hosted search (web_search / x_search):");
  });

  it("injects server workspace snapshot before model when atxfinance tool is active", async () => {
    workspaceSnapshotMocks.buildWorkspaceServerSnapshotBlock.mockResolvedValueOnce(
      "Workspace snapshot (loaded server-side for this request; SNAPSHOT_TEST_MARKER"
    );
    repositoryMocks.resolveDefaultXchatPersonaForSession.mockResolvedValueOnce(
      buildPersona({
        xapi: {
          mode: "responses",
          toolChoice: "auto",
          maxTurns: 5,
          tools: [{ type: "atxfinance" }, { type: "web_search" }]
        }
      })
    );
    repositoryMocks.getPersonaById.mockResolvedValueOnce(
      buildPersona({
        xapi: {
          mode: "responses",
          toolChoice: "auto",
          maxTurns: 5,
          tools: [{ type: "atxfinance" }, { type: "web_search" }]
        }
      })
    );

    const response = await postAsk(
      new Request("http://test/api/xchat/ask", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: "summarize my workspace"
        })
      })
    );

    expect(response.status).toBe(200);
    expect(workspaceSnapshotMocks.buildWorkspaceServerSnapshotBlock).toHaveBeenCalledWith({
      userId: "507f1f77bcf86cd799439011",
      tenantId: "507f1f77bcf86cd799439022"
    });
    expect(xaiMocks.respondWithXaiToolLoop).toHaveBeenCalledWith(
      expect.objectContaining({
        systemPrompt: expect.stringContaining("SNAPSHOT_TEST_MARKER")
      })
    );
  });

  it("uses assigned persona when request persona differs for app_user", async () => {
    authMocks.requireSessionUser.mockResolvedValueOnce({
      userId: "507f1f77bcf86cd799439011",
      tenantId: "507f1f77bcf86cd799439022",
      email: "viewer@atxfinance.ai",
      username: "xf-viewer",
      roles: ["viewer"]
    });
    coreAdminRepositoryMocks.getUserAdminSettings.mockResolvedValueOnce({
      assignedPersonaId: "507f1f77bcf86cd799439088"
    });
    repositoryMocks.getPersonaById.mockResolvedValueOnce(
      buildPersona({
        _id: new ObjectId("507f1f77bcf86cd799439088"),
        name: "atx-trusted-advisor",
        nameNormalized: "atx-trusted-advisor"
      })
    );

    const response = await postAsk(
      new Request("http://test/api/xchat/ask", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          personaId: "507f1f77bcf86cd799439077",
          message: "somegoodnewstx"
        })
      })
    );

    expect(response.status).toBe(200);
    expect(repositoryMocks.getPersonaById).toHaveBeenCalledWith("507f1f77bcf86cd799439088");
  });

  it("allows app_user assigned Super-Agent when persona is published", async () => {
    authMocks.requireSessionUser.mockResolvedValueOnce({
      userId: "507f1f77bcf86cd799439011",
      tenantId: "507f1f77bcf86cd799439022",
      email: "viewer@atxfinance.ai",
      username: "xf-viewer",
      roles: ["viewer"]
    });
    coreAdminRepositoryMocks.getUserAdminSettings.mockResolvedValueOnce({
      assignedPersonaId: "507f1f77bcf86cd799439099"
    });
    repositoryMocks.getPersonaById.mockResolvedValueOnce(
      buildPersona({
        _id: new ObjectId("507f1f77bcf86cd799439099"),
        name: "Super-Agent",
        nameNormalized: "super-agent",
        status: "published"
      })
    );

    const response = await postAsk(
      new Request("http://test/api/xchat/ask", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: "somegoodnewstx"
        })
      })
    );

    expect(response.status).toBe(200);
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
    expect(xaiMocks.respondWithXaiToolLoop).not.toHaveBeenCalled();
  });

  it("uses persona model for effective xAI model (body model field is not accepted)", async () => {
    authMocks.requireSessionUser.mockResolvedValueOnce({
      userId: "507f1f77bcf86cd799439011",
      tenantId: "507f1f77bcf86cd799439022",
      email: "viewer@atxfinance.ai",
      username: "xf-viewer",
      roles: ["viewer"]
    });
    repositoryMocks.resolveDefaultXchatPersonaForSession.mockResolvedValueOnce(
      buildPersona({
        name: "atx-trusted-advisor",
        model: "grok-from-persona-doc"
      })
    );

    const response = await postAsk(
      new Request("http://test/api/xchat/ask", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: "which model runs",
          model: "grok-4.20-multi-agent"
        })
      })
    );
    const payload = (await response.json()) as {
      data?: { modelSelectionSource?: string };
    };

    expect(response.status).toBe(200);
    expect(payload.data?.modelSelectionSource).toBe("persona");
    expect(xaiMocks.respondWithXaiToolLoop).toHaveBeenCalledWith(
      expect.objectContaining({
        model: "grok-from-persona-doc"
      })
    );
    expect(xaiMocks.respondWithXai).not.toHaveBeenCalled();
  });

  it("maps multi-agent effort high to 16 agents when persona model is grok-4.20-multi-agent", async () => {
    repositoryMocks.resolveDefaultXchatPersonaForSession.mockResolvedValueOnce(
      buildPersona({
        model: "grok-4.20-multi-agent"
      })
    );

    const response = await postAsk(
      new Request("http://test/api/xchat/ask", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: "run multi-agent",
          reasoningEffort: "high"
        })
      })
    );

    expect(response.status).toBe(200);
    expect(xaiMocks.respondWithXaiToolLoop).toHaveBeenCalledWith(
      expect.objectContaining({
        model: "grok-4.20-multi-agent",
        parallelism: {
          agentCount: 16,
          reasoningEffort: "high"
        }
      })
    );
    expect(xaiMocks.respondWithXai).not.toHaveBeenCalled();
    expect(identityMocks.getCoreUserById).not.toHaveBeenCalled();
  });

  it("rejects reasoningEffort when model is not multi-agent", async () => {
    repositoryMocks.resolveDefaultXchatPersonaForSession.mockResolvedValueOnce(
      buildPersona({
        model: "grok-4-1-fast-reasoning"
      })
    );
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
    expect(xaiMocks.respondWithXaiToolLoop).not.toHaveBeenCalled();
  });

  it("loads core user for non-admin ask to apply multi-agent plan clamp", async () => {
    identityMocks.getCoreUserById.mockResolvedValueOnce({
      subscriptionPlan: "enterprise"
    } as never);
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
          message: "viewer plan clamp path",
          topK: 4
        })
      })
    );

    expect(response.status).toBe(200);
    expect(identityMocks.getCoreUserById).toHaveBeenCalledTimes(1);
    const firstArg = identityMocks.getCoreUserById.mock.calls[0]?.[0] as ObjectId;
    expect(firstArg.toHexString()).toBe("507f1f77bcf86cd799439011");
    expect(xaiMocks.respondWithXaiToolLoop).toHaveBeenCalledWith(
      expect.objectContaining({
        parallelism: undefined
      })
    );
    expect(xaiMocks.respondWithXai).not.toHaveBeenCalled();
  });
});
