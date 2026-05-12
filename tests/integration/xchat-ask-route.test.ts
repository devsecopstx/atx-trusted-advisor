import { ObjectId } from "mongodb";
import { NextResponse } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { getXaiFinanceCollectionId } from "@/lib/xai-finance-collection";

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
  getLatestXchatLogByThread: vi.fn(),
  getLatestXchatResponseIdByUser: vi.fn(),
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
  getUserAdminSettings: vi.fn(),
  getDefaultPortfolio: vi.fn().mockResolvedValue(null)
}));

const ragReadinessMocks = vi.hoisted(() => ({
  getScopeReadinessSummary: vi.fn()
}));

const prefsMocks = vi.hoisted(() => ({
  getXchatUserPreferences: vi.fn()
}));

const platformSettingsMocks = vi.hoisted(() => ({
  getXchatPlatformSettings: vi.fn()
}));

const auditMocks = vi.hoisted(() => ({
  createAuditEvent: vi.fn()
}));

const defaultWorkspaceLimits = {
  userXoptionsLimit: 10,
  userChatLimit: 10,
  tenantPortfolioLimit: 1,
  portfolioAccountLimit: 1,
  changePersonaEnabled: true,
  chatHistoryMax: 10,
  maxUsersPerTenant: 5,
  userTasksMax: 5,
  outlookRefreshEnabled: true
};

const identityMocks = vi.hoisted(() => ({
  getCoreUserById: vi.fn(),
  getCoreUserOptionsScanPreferences: vi.fn(),
  updateCoreUserOptionsScanPreferences: vi.fn(),
  getTenantByHexId: vi.fn(),
  resolveTenantIdHexForGlobalAdminConsole: vi.fn(),
  resolvedWorkspaceLimitsForTenant: vi.fn()
}));

const optionsScanReportMocks = vi.hoisted(() => ({
  createOptionsScanReport: vi.fn()
}));

const workspaceSnapshotMocks = vi.hoisted(() => ({
  loadWorkspaceSnapshotPreload: vi.fn(),
  formatWorkspaceServerSnapshotBlock: vi.fn()
}));

const symbolLookupMocks = vi.hoisted(() => ({
  lookupSymbols: vi.fn()
}));

vi.mock("@/lib/auth", () => authMocks);
vi.mock("@/lib/xai", () => xaiMocks);
vi.mock("@/modules/xchat/ask-usage-limits", () => usageLimitMocks);
vi.mock("@/modules/xchat/repository", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/modules/xchat/repository")>();
  return { ...actual, ...repositoryMocks };
});
vi.mock("@/modules/xchat/team-xai-collection", () => teamKbMocks);
vi.mock("@/modules/xchat/xai-collection-verifier", () => verifierMocks);
vi.mock("@/modules/core-admin/repository", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/modules/core-admin/repository")>();
  return {
    ...actual,
    getUserAdminSettings: coreAdminRepositoryMocks.getUserAdminSettings,
    getDefaultPortfolio: coreAdminRepositoryMocks.getDefaultPortfolio
  };
});
vi.mock("@/modules/xchat/account-outlook-context", () => ({
  resolveAccountOutlookContextForXchat: vi.fn().mockResolvedValue(null),
  formatAccountOutlookPromptInjection: vi.fn(() => "")
}));
vi.mock("@/modules/xchat/rag-file-readiness", () => ragReadinessMocks);
vi.mock("@/modules/xchat/user-preferences-repository", () => prefsMocks);
vi.mock("@/modules/xchat/xchat-platform-settings", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/modules/xchat/xchat-platform-settings")>();
  return {
    ...actual,
    getXchatPlatformSettings: platformSettingsMocks.getXchatPlatformSettings
  };
});
vi.mock("@/modules/audit/repository", () => auditMocks);
vi.mock("@/modules/identity/repository", () => identityMocks);
vi.mock("@/modules/xchat/options-action-report-repository", () => optionsScanReportMocks);
vi.mock("@/modules/xchat/workspace-snapshot-for-prompt", () => ({
  loadWorkspaceSnapshotPreload: workspaceSnapshotMocks.loadWorkspaceSnapshotPreload,
  formatWorkspaceServerSnapshotBlock: workspaceSnapshotMocks.formatWorkspaceServerSnapshotBlock
}));
vi.mock("@/modules/watchlist/yahoo-symbol-lookup", () => ({
  lookupSymbols: symbolLookupMocks.lookupSymbols
}));

vi.mock("@/lib/xai-default-persona-model", () => ({
  getDefaultPersonaChatModelId: () => "grok-4-1-fast-reasoning"
}));

import { POST as postAsk } from "@/app/api/xchat/ask/route";
import * as toolExecutorModule from "@/modules/xchat/tool-executor";

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
    vi.unstubAllEnvs();
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
    repositoryMocks.getLatestXchatLogByThread.mockResolvedValue(null);
    repositoryMocks.getLatestXchatResponseIdByUser.mockResolvedValue(null);
    repositoryMocks.getPersonaById.mockResolvedValue(buildPersona());
    repositoryMocks.listXChatHistoryByUser.mockResolvedValue([]);
    repositoryMocks.saveXChatLog.mockResolvedValue(new ObjectId("507f1f77bcf86cd799439099"));
    xaiMocks.searchDocumentsInCollections.mockResolvedValue([]);
    auditMocks.createAuditEvent.mockResolvedValue(undefined);
    identityMocks.getCoreUserById.mockResolvedValue({
      subscriptionPlan: "basic",
      billing: {
        override: {
          enabled: true
        }
      }
    } as never);
    identityMocks.getCoreUserOptionsScanPreferences.mockResolvedValue({
      frequency: "off",
      deliveryChannel: "inapp"
    });
    identityMocks.updateCoreUserOptionsScanPreferences.mockResolvedValue({
      frequency: "off",
      deliveryChannel: "inapp",
      lastRunAt: new Date("2026-04-25T00:00:00.000Z")
    });
    identityMocks.getTenantByHexId.mockResolvedValue(null);
    identityMocks.resolveTenantIdHexForGlobalAdminConsole.mockResolvedValue(null);
    identityMocks.resolvedWorkspaceLimitsForTenant.mockReturnValue(defaultWorkspaceLimits);
    optionsScanReportMocks.createOptionsScanReport.mockResolvedValue(
      new ObjectId("507f1f77bcf86cd7994390ab")
    );
    coreAdminRepositoryMocks.getUserAdminSettings.mockResolvedValue(null);
    verifierMocks.verifyXaiCollectionNonBlocking.mockImplementation(() => {});
    ragReadinessMocks.getScopeReadinessSummary.mockResolvedValue({
      blocked: false,
      nonReadyFiles: []
    });
    prefsMocks.getXchatUserPreferences.mockResolvedValue({
      keepLastTenMessages: true,
      enableLongTermXaiMemory: false
    });
    platformSettingsMocks.getXchatPlatformSettings.mockResolvedValue(null);
    workspaceSnapshotMocks.loadWorkspaceSnapshotPreload.mockResolvedValue(null);
    workspaceSnapshotMocks.formatWorkspaceServerSnapshotBlock.mockReturnValue("");
    symbolLookupMocks.lookupSymbols.mockResolvedValue(new Map());
  });

  it("accepts imageAttachment and forwards a data URL to respondWithXaiToolLoop (uses persona model when XAI_VISION_MODEL unset)", async () => {
    const tinyPngBase64 =
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";
    const response = await postAsk(
      new Request("http://test/api/xchat/ask", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          personaId: "507f1f77bcf86cd799439055",
          message: "Describe this pixel.",
          imageAttachment: {
            mediaType: "image/png",
            dataBase64: tinyPngBase64
          },
          topK: 4
        })
      })
    );
    expect(response.status).toBe(200);
    const call = xaiMocks.respondWithXaiToolLoop.mock.calls.at(-1)?.[0] as {
      userImageDataUrl?: string;
      model?: string;
    };
    expect(call?.userImageDataUrl?.startsWith("data:image/png;base64,")).toBe(true);
    expect(call?.model).toBe("grok-4-1-fast");
  });

  it("uses XAI_VISION_MODEL for image turns when set", async () => {
    vi.stubEnv("XAI_VISION_MODEL", "grok-4.20-reasoning");
    const tinyPngBase64 =
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";
    try {
      const response = await postAsk(
        new Request("http://test/api/xchat/ask", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            personaId: "507f1f77bcf86cd799439055",
            message: "Describe this pixel.",
            imageAttachment: {
              mediaType: "image/png",
              dataBase64: tinyPngBase64
            },
            topK: 4
          })
        })
      );
      expect(response.status).toBe(200);
      const call = xaiMocks.respondWithXaiToolLoop.mock.calls.at(-1)?.[0] as { model?: string };
      expect(call?.model).toBe("grok-4.20-reasoning");
    } finally {
      vi.unstubAllEnvs();
    }
  });

  it("downgrades multi-agent persona model to default chat model on image turns", async () => {
    repositoryMocks.getPersonaById.mockResolvedValue(
      buildPersona({ model: "grok-4.20-multi-agent" })
    );
    repositoryMocks.resolveDefaultXchatPersonaForSession.mockResolvedValue(
      buildPersona({ model: "grok-4.20-multi-agent" })
    );
    const tinyPngBase64 =
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";
    const response = await postAsk(
      new Request("http://test/api/xchat/ask", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          personaId: "507f1f77bcf86cd799439055",
          message: "What is in this image?",
          imageAttachment: {
            mediaType: "image/png",
            dataBase64: tinyPngBase64
          },
          reasoningEffort: "low",
          topK: 4
        })
      })
    );
    expect(response.status).toBe(200);
    const call = xaiMocks.respondWithXaiToolLoop.mock.calls.at(-1)?.[0] as {
      model?: string;
      parallelism?: unknown;
    };
    expect(call?.model).toBe("grok-4-1-fast-reasoning");
    expect(call?.parallelism).toBeUndefined();
  });

  it("preprocesses assistant markdown on the server before JSON and xchat_logs", async () => {
    xaiMocks.respondWithXaiToolLoop.mockResolvedValueOnce({
      outputText: "Summary line\nXF_CITE:yahoo_finance\nMore text\nXF_CITE:atxfinance\n",
      model: "grok-4-latest",
      toolCalls: [],
      turnsUsed: 1,
      raw: {}
    });
    const response = await postAsk(
      new Request("http://test/api/xchat/ask", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          personaId: "507f1f77bcf86cd799439055",
          message: "Test preprocess",
          topK: 4
        })
      })
    );
    expect(response.status).toBe(200);
    const payload = (await response.json()) as { data: { response: string } };
    expect(payload.data.response).toContain("`XF_CITE:yahoo_finance`");
    expect(payload.data.response).toContain("`XF_CITE:atx_function`");
    const saved = repositoryMocks.saveXChatLog.mock.calls.at(-1)?.[0] as { response: string };
    expect(saved.response).toContain("`XF_CITE:yahoo_finance`");
    expect(saved.response).toBe(payload.data.response);
  });

  it("echoes xaiUsage on 200 when Responses raw includes usage (client rail + logs)", async () => {
    xaiMocks.respondWithXaiToolLoop.mockResolvedValueOnce({
      outputText: "ok",
      model: "grok-4-latest",
      toolCalls: [],
      turnsUsed: 1,
      raw: {
        usage: {
          prompt_tokens: 100,
          completion_tokens: 40,
          total_tokens: 140
        }
      }
    });
    const response = await postAsk(
      new Request("http://test/api/xchat/ask", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          personaId: "507f1f77bcf86cd799439055",
          message: "Usage echo test",
          topK: 4
        })
      })
    );
    expect(response.status).toBe(200);
    const payload = (await response.json()) as {
      data: {
        xaiUsage?: { inputTokens: number; outputTokens: number; totalTokens: number };
      };
    };
    expect(payload.data.xaiUsage).toEqual({
      inputTokens: 100,
      outputTokens: 40,
      totalTokens: 140
    });
    const saved = repositoryMocks.saveXChatLog.mock.calls.at(-1)?.[0] as {
      xaiUsage?: { inputTokens: number; outputTokens: number; totalTokens: number };
    };
    expect(saved.xaiUsage).toEqual(payload.data.xaiUsage);
  });

  it("does not persist xchat_logs when keep-last-10 is not enabled", async () => {
    prefsMocks.getXchatUserPreferences.mockResolvedValueOnce({
      keepLastTenMessages: false
    });
    const response = await postAsk(
      new Request("http://test/api/xchat/ask", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: "ephemeral continuity",
          recentMessages: [{ role: "user", content: "prior prompt" }]
        })
      })
    );
    expect(response.status).toBe(200);
    expect(repositoryMocks.saveXChatLog).not.toHaveBeenCalled();
    expect(xaiMocks.respondWithXaiToolLoop).toHaveBeenCalledWith(
      expect.objectContaining({
        systemPrompt: expect.stringContaining("Recent thread messages")
      })
    );
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
    const financeCollectionId = getXaiFinanceCollectionId();
    expect(verifierMocks.verifyXaiCollectionNonBlocking).toHaveBeenCalledWith(financeCollectionId);
    expect(verifierMocks.verifyXaiCollectionNonBlocking).toHaveBeenCalledTimes(1);
    expect(xaiMocks.searchDocumentsInCollections).toHaveBeenCalledWith(
      expect.objectContaining({
        collectionIds: [financeCollectionId]
      })
    );
    expect(repositoryMocks.listXChatHistoryByUser).not.toHaveBeenCalled();
    expect(xaiMocks.respondWithXaiToolLoop).toHaveBeenCalledWith(
      expect.objectContaining({
        systemPrompt: expect.stringContaining("Collection context snippet"),
        toolChoice: "auto",
        maxTurns: 5,
        tools: expect.arrayContaining([
          expect.objectContaining({ type: "web_search", name: "web_search" }),
          expect.objectContaining({
            type: "file_search",
            name: "file_search",
            vector_store_ids: [getXaiFinanceCollectionId()]
          })
        ]),
        userPrompt: expect.stringMatching(
          /\[Persona \/ KB metadata — xChat and batch[\s\S]*xChat linked xAI collection ids[\s\S]*Persona xAPI tools[\s\S]*- web_search/
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

  it("uses local prompt continuity (remote history continuation disabled)", async () => {
    const response = await postAsk(
      new Request("http://test/api/xchat/ask", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: "continue prior local thread"
        })
      })
    );
    expect(response.status).toBe(200);
    expect(repositoryMocks.listXChatHistoryByUser).not.toHaveBeenCalled();
    expect(repositoryMocks.getLatestXchatResponseIdByUser).not.toHaveBeenCalled();
    expect(xaiMocks.respondWithXaiToolLoop).toHaveBeenCalledWith(
      expect.not.objectContaining({
        previousResponseId: expect.any(String),
        storeMessages: true
      })
    );
  });

  it("includes full thread history in the Responses tool loop when long-term xAI memory is enabled", async () => {
    prefsMocks.getXchatUserPreferences.mockResolvedValueOnce({
      keepLastTenMessages: true,
      enableLongTermXaiMemory: true
    });

    const response = await postAsk(
      new Request("http://test/api/xchat/ask", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          personaId: "507f1f77bcf86cd799439055",
          message: "Continue the same wheel on NVDA",
          recentMessages: [
            { role: "user", content: "Build a wheel on NVDA" },
            { role: "assistant", content: "Use 45-dte puts around 0.30 delta." }
          ],
          topK: 4
        })
      })
    );

    expect(response.status).toBe(200);
    expect(xaiMocks.respondWithXaiToolLoop).toHaveBeenCalledWith(
      expect.objectContaining({
        conversationInput: expect.arrayContaining([
          expect.objectContaining({ role: "user", content: "Build a wheel on NVDA" }),
          expect.objectContaining({ role: "assistant", content: "Use 45-dte puts around 0.30 delta." })
        ])
      })
    );
  });

  it("when XCHAT_USE_REMOTE_HISTORY and prior xaiResponseId, sends previous_response_id and omits client recent thread block", async () => {
    vi.stubEnv("XCHAT_USE_REMOTE_HISTORY", "true");
    prefsMocks.getXchatUserPreferences.mockResolvedValueOnce({
      keepLastTenMessages: true,
      enableLongTermXaiMemory: true
    });
    try {
      repositoryMocks.getLatestXchatLogByThread.mockImplementation(
        async (input: { personaId?: ObjectId }) => {
          if (input.personaId) {
            return { xaiResponseId: "resp_remote_prev_1" } as {
              xaiResponseId: string;
            };
          }
          return null;
        }
      );

      const response = await postAsk(
        new Request("http://test/api/xchat/ask", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            personaId: "507f1f77bcf86cd799439055",
            message: "Second turn",
            threadId: "thread-remote-1",
            recentMessages: [{ role: "user", content: "First turn summary from client" }],
            topK: 4
          })
        })
      );

      expect(response.status).toBe(200);
      expect(xaiMocks.respondWithXaiToolLoop).toHaveBeenCalledWith(
        expect.objectContaining({
          previousResponseId: "resp_remote_prev_1",
          storeMessages: true
        })
      );
      const call = xaiMocks.respondWithXaiToolLoop.mock.calls.at(-1)?.[0] as {
        systemPrompt: string;
      };
      expect(call.systemPrompt).not.toContain("Recent thread messages");
    } finally {
      vi.unstubAllEnvs();
      repositoryMocks.getLatestXchatLogByThread.mockResolvedValue(null);
    }
  });

  it("keeps five-turn conservative wheel continuity with portfolio context in-thread", async () => {
    repositoryMocks.resolveDefaultXchatPersonaForSession.mockResolvedValue(
      buildPersona({
        xapi: {
          mode: "responses",
          toolChoice: "auto",
          maxTurns: 5,
          tools: [{ type: "atx_function" }]
        }
      })
    );
    repositoryMocks.getPersonaById.mockResolvedValue(
      buildPersona({
        xapi: {
          mode: "responses",
          toolChoice: "auto",
          maxTurns: 5,
          tools: [{ type: "atx_function" }]
        }
      })
    );

    const threadId = "thread_hnwi_wheel_5turn";
    const portfolioId = "507f1f77bcf86cd799439044";
    const turns = [
      {
        message: "Suggest conservative income strategy for this month.",
        recentMessages: [
          {
            role: "assistant" as const,
            content:
              "Portfolio snapshot: $279,524 cost basis, 36% cash, account mix TOD/IRA/ROTH/Joint."
          }
        ]
      },
      {
        message: "Focus NVDA and TSLA first.",
        recentMessages: [
          {
            role: "assistant" as const,
            content:
              "Prior recommendation: covered calls on NVDA and wheel overlay on TSLA with conservative delta."
          }
        ]
      },
      {
        message: "Show me downside protection alternatives.",
        recentMessages: [
          {
            role: "assistant" as const,
            content: "Prior recommendation kept wheel overlay for TSLA and flagged concentration in top 3 names."
          }
        ]
      },
      {
        message: "Use expert depth and keep risk conservative.",
        recentMessages: [
          {
            role: "assistant" as const,
            content: "Last scan favored covered-call income over aggressive call spreads."
          }
        ]
      },
      {
        message: "Finalize next actions for this week.",
        recentMessages: [
          {
            role: "assistant" as const,
            content:
              "Carry forward: wheel overlay on NVDA with conservative sizing; review concentration before new risk."
          }
        ]
      }
    ];

    for (const turn of turns) {
      const response = await postAsk(
        new Request("http://test/api/xchat/ask", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            message: turn.message,
            threadId,
            portfolioId,
            strategyJobOptOut: true,
            recentMessages: turn.recentMessages
          })
        })
      );
      expect(response.status).toBe(200);
    }

    expect(workspaceSnapshotMocks.loadWorkspaceSnapshotPreload).toHaveBeenCalledTimes(5);
    const allSystemPrompts = xaiMocks.respondWithXaiToolLoop.mock.calls
      .map((call) => (call[0] as { systemPrompt: string }).systemPrompt)
      .join("\n");
    expect(allSystemPrompts).toContain("Recent thread messages");
    expect(allSystemPrompts).toContain("279,524");
    expect(allSystemPrompts).toContain("wheel overlay");
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

  it("searches canonical Finance collection when persona has no linked collection ids", async () => {
    teamKbMocks.resolveTeamKbCollectionId.mockResolvedValueOnce("collection_env_only_not_merged");
    repositoryMocks.resolveDefaultXchatPersonaForSession.mockResolvedValueOnce(
      buildPersona({
        teamCollection: { collectionId: "", collectionName: "" },
        xaiCollection: { collectionId: "", collectionName: "" },
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
          message: "No linked collections path",
          topK: 4
        })
      })
    );

    const payload = (await response.json()) as { data: { contextSource: string; contextCount: number } };
    expect(response.status).toBe(200);
    expect(payload.data.contextSource).toBe("none");
    expect(payload.data.contextCount).toBe(0);
    expect(xaiMocks.searchDocumentsInCollections).toHaveBeenCalledWith(
      expect.objectContaining({
        collectionIds: [getXaiFinanceCollectionId()]
      })
    );
    expect(verifierMocks.verifyXaiCollectionNonBlocking).toHaveBeenCalledWith(
      getXaiFinanceCollectionId()
    );
  });

  it("replaces file_search vector stores with persona-linked ids (replace mode)", async () => {
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
          message: "persona-linked file_search wiring"
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
            vector_store_ids: [getXaiFinanceCollectionId()]
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
            vector_store_ids: [getXaiFinanceCollectionId()]
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
        xapiToolCount: 2
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
    expect(payload.error).toBe(
      "Too many messages sent in a short window. Pause briefly and try again."
    );
    expect(payload.retryAfterSeconds).toBeGreaterThan(0);
    expect(response.headers.get("x-xchat-limit-remaining-minute")).toBe("0");
    expect(response.headers.get("retry-after")).toBe("30");
  });

  it("applies plan override chat caps for non-admin usage limiter input", async () => {
    authMocks.requireSessionUser.mockResolvedValueOnce({
      userId: "507f1f77bcf86cd799439011",
      tenantId: "507f1f77bcf86cd799439022",
      email: "premiumplus@atxfinance.ai",
      username: "xf-premiumplus",
      roles: ["viewer"]
    });
    identityMocks.getCoreUserById.mockResolvedValueOnce({
      subscriptionPlan: "premium_plus",
      billing: {
        override: {
          enabled: true
        }
      }
    } as never);
    identityMocks.getTenantByHexId.mockResolvedValueOnce({
      _id: new ObjectId("507f1f77bcf86cd799439022"),
      workspaceLimits: {
        userChatLimit: 1,
        userChatHourlyLimit: 1,
        planOverrides: {
          premium_plus_monthly: {
            userChatLimit: 1000,
            userChatHourlyLimit: 250
          }
        }
      }
    } as never);

    const response = await postAsk(
      new Request("http://test/api/xchat/ask", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: "plan override limiter path" })
      })
    );

    expect(response.status).toBe(200);
    expect(usageLimitMocks.enforceDistributedAskUsageLimit).toHaveBeenCalledWith(
      expect.objectContaining({
        dailyPromptLimit: 1000,
        hourlyPromptLimit: 250
      })
    );
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

  it("does not inject atx_function for app_user when persona omits it", async () => {
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
    expect(toolLoopArg?.systemPrompt ?? "").not.toContain("Workspace snapshot");
    expect(toolLoopArg?.systemPrompt ?? "").toContain("Hosted search (web_search / x_search):");
  });

  it("eager-calls workspace snapshot load when atx_function is active; executor uses lazy load when preload is null", async () => {
    const createSpy = vi.spyOn(toolExecutorModule, "createXfinanceToolExecutor");
    repositoryMocks.resolveDefaultXchatPersonaForSession.mockResolvedValueOnce(
      buildPersona({
        xapi: {
          mode: "responses",
          toolChoice: "auto",
          maxTurns: 5,
          tools: [{ type: "atx_function" }, { type: "web_search" }]
        }
      })
    );
    repositoryMocks.getPersonaById.mockResolvedValueOnce(
      buildPersona({
        xapi: {
          mode: "responses",
          toolChoice: "auto",
          maxTurns: 5,
          tools: [{ type: "atx_function" }, { type: "web_search" }]
        }
      })
    );

    try {
      const response = await postAsk(
        new Request("http://test/api/xchat/ask", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            message: "summarize my workspace",
            portfolioId: "507f1f77bcf86cd799439044"
          })
        })
      );

      expect(response.status).toBe(200);
      expect(workspaceSnapshotMocks.loadWorkspaceSnapshotPreload).toHaveBeenCalledTimes(1);
      expect(workspaceSnapshotMocks.loadWorkspaceSnapshotPreload).toHaveBeenCalledWith(
        {
          userId: "507f1f77bcf86cd799439011",
          tenantId: "507f1f77bcf86cd799439022",
          workspacePortfolioId: "507f1f77bcf86cd799439044"
        },
        expect.objectContaining({
          snapshotQuoteNetwork: expect.any(String)
        })
      );
      const toolLoopArg = xaiMocks.respondWithXaiToolLoop.mock.calls[0]?.[0] as {
        systemPrompt?: string;
      };
      expect(toolLoopArg?.systemPrompt ?? "").not.toContain("Workspace snapshot");
      expect(toolLoopArg?.systemPrompt ?? "").toContain("atx_function");
      const ctx = createSpy.mock.calls[0]?.[0];
      expect(ctx).toMatchObject({
        userId: "507f1f77bcf86cd799439011",
        tenantId: "507f1f77bcf86cd799439022",
        workspacePortfolioId: "507f1f77bcf86cd799439044",
        workspaceLazyLoad: {
          userId: "507f1f77bcf86cd799439011",
          tenantId: "507f1f77bcf86cd799439022",
          workspacePortfolioId: "507f1f77bcf86cd799439044"
        }
      });
      expect(ctx?.workspacePreload).toBeUndefined();
    } finally {
      createSpy.mockRestore();
    }
  });

  it("prefers request persona over assigned when sidebar persona differs for app_user", async () => {
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
    repositoryMocks.getPersonaById.mockImplementation((id: string) => {
      if (id === "507f1f77bcf86cd799439077") {
        return Promise.resolve(
          buildPersona({
            _id: new ObjectId("507f1f77bcf86cd799439077"),
            name: "xfinance-options",
            nameNormalized: "xfinance-options"
          })
        );
      }
      if (id === "507f1f77bcf86cd799439088") {
        return Promise.resolve(
          buildPersona({
            _id: new ObjectId("507f1f77bcf86cd799439088"),
            name: "atx-trusted-advisor",
            nameNormalized: "atx-trusted-advisor"
          })
        );
      }
      return Promise.resolve(buildPersona());
    });

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
    expect(repositoryMocks.getPersonaById).toHaveBeenNthCalledWith(
      1,
      "507f1f77bcf86cd799439077"
    );
  });

  it("uses assigned persona only when changePersonaEnabled is false for app_user", async () => {
    authMocks.requireSessionUser.mockResolvedValueOnce({
      userId: "507f1f77bcf86cd799439011",
      tenantId: "507f1f77bcf86cd799439022",
      email: "viewer@atxfinance.ai",
      username: "xf-viewer",
      roles: ["viewer"]
    });
    identityMocks.getTenantByHexId.mockResolvedValueOnce({
      _id: new ObjectId("507f1f77bcf86cd799439022"),
      workspaceLimits: { changePersonaEnabled: false }
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
    expect(repositoryMocks.getPersonaById).toHaveBeenCalledTimes(1);
    expect(repositoryMocks.getPersonaById).toHaveBeenCalledWith("507f1f77bcf86cd799439088");
  });

  it("falls back to default persona when assigned persona is missing", async () => {
    authMocks.requireSessionUser.mockResolvedValueOnce({
      userId: "507f1f77bcf86cd799439011",
      tenantId: "507f1f77bcf86cd799439022",
      email: "viewer@atxfinance.ai",
      username: "xf-viewer",
      roles: ["viewer"]
    });
    coreAdminRepositoryMocks.getUserAdminSettings.mockResolvedValueOnce({
      assignedPersonaId: "507f1f77bcf86cd799439066"
    });
    repositoryMocks.getPersonaById.mockResolvedValueOnce(null);

    const response = await postAsk(
      new Request("http://test/api/xchat/ask", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: "hello world"
        })
      })
    );

    expect(response.status).toBe(200);
    expect(repositoryMocks.getPersonaById).toHaveBeenCalledWith("507f1f77bcf86cd799439066");
    expect(xaiMocks.respondWithXaiToolLoop).toHaveBeenCalled();
  });

  it("allows app_user assigned advisor (global-admin default) when persona is published", async () => {
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
        name: "advisor",
        nameNormalized: "advisor",
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
    expect(payload.data?.modelSelectionSource).toBe("reasoning_mode");
    expect(xaiMocks.respondWithXaiToolLoop).toHaveBeenCalledWith(
      expect.objectContaining({
        model: "grok-4-1-fast"
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

  it("routes legacy reasoningEffort on non-multi-agent persona to grok-4.3 reasoning (global_admin)", async () => {
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
          message: "multi-angle desk review",
          reasoningEffort: "low"
        })
      })
    );

    expect(response.status).toBe(200);
    expect(xaiMocks.respondWithXaiToolLoop).toHaveBeenCalledWith(
      expect.objectContaining({
        model: "grok-4.3",
        parallelism: undefined,
        responsesReasoning: { effort: "low" }
      })
    );
    expect(xaiMocks.respondWithXai).not.toHaveBeenCalled();
  });

  it("routes legacy reasoningEffort none on non-multi-agent persona to grok-4.3 with reasoning disabled", async () => {
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
          message: "quick grok 4.3 turn without reasoning tokens",
          reasoningEffort: "none"
        })
      })
    );

    expect(response.status).toBe(200);
    expect(xaiMocks.respondWithXaiToolLoop).toHaveBeenCalledWith(
      expect.objectContaining({
        model: "grok-4.3",
        parallelism: undefined,
        responsesReasoning: { effort: "none" }
      })
    );
  });

  it("rejects reasoningEffort none when persona model is multi-agent", async () => {
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
          message: "invalid combo",
          reasoningEffort: "none"
        })
      })
    );

    expect(response.status).toBe(400);
    const payload = (await response.json()) as { code?: string };
    expect(payload.code).toBe("invalid_reasoning_effort");
    expect(xaiMocks.respondWithXaiToolLoop).not.toHaveBeenCalled();
  });

  it("rejects ask when reasoningMode and reasoningEffort are both sent", async () => {
    const response = await postAsk(
      new Request("http://test/api/xchat/ask", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: "conflicting reasoning controls",
          reasoningMode: "expert",
          reasoningEffort: "high"
        })
      })
    );
    expect(response.status).toBe(400);
    expect(xaiMocks.respondWithXaiToolLoop).not.toHaveBeenCalled();
  });

  it("uses grok-4.3 medium reasoning when reasoningMode expert (premium_plus viewer)", async () => {
    identityMocks.getCoreUserById.mockResolvedValueOnce({
      subscriptionPlan: "premium_plus",
      billing: {
        override: {
          enabled: true
        }
      }
    } as never);
    authMocks.requireSessionUser.mockResolvedValueOnce({
      userId: "507f1f77bcf86cd799439011",
      tenantId: "507f1f77bcf86cd799439022",
      email: "viewer@atxfinance.ai",
      username: "xf-viewer",
      roles: ["viewer"]
    });
    repositoryMocks.resolveDefaultXchatPersonaForSession.mockResolvedValueOnce(
      buildPersona({ model: "grok-4-1-fast-reasoning" })
    );

    const response = await postAsk(
      new Request("http://test/api/xchat/ask", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: "Compare bull and bear cases for my largest holding.",
          reasoningMode: "expert"
        })
      })
    );

    expect(response.status).toBe(200);
    expect(xaiMocks.respondWithXaiToolLoop).toHaveBeenCalledWith(
      expect.objectContaining({
        model: "grok-4.3",
        parallelism: undefined,
        responsesReasoning: { effort: "medium" }
      })
    );
  });

  it("uses grok-4.3 with medium reasoning when basic tier uses reasoningMode expert", async () => {
    identityMocks.getCoreUserById.mockResolvedValueOnce({
      subscriptionPlan: "basic",
      billing: {
        override: {
          enabled: true
        }
      }
    } as never);
    authMocks.requireSessionUser.mockResolvedValueOnce({
      userId: "507f1f77bcf86cd799439011",
      tenantId: "507f1f77bcf86cd799439022",
      email: "viewer@atxfinance.ai",
      username: "xf-viewer",
      roles: ["viewer"]
    });
    repositoryMocks.resolveDefaultXchatPersonaForSession.mockResolvedValueOnce(
      buildPersona({ model: "grok-4-1-fast-reasoning" })
    );

    const response = await postAsk(
      new Request("http://test/api/xchat/ask", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: "Think harder about my book.",
          reasoningMode: "expert"
        })
      })
    );

    expect(response.status).toBe(200);
    expect(xaiMocks.respondWithXaiToolLoop).toHaveBeenCalledWith(
      expect.objectContaining({
        model: "grok-4.3",
        parallelism: undefined,
        responsesReasoning: { effort: "medium" }
      })
    );
  });

  it("loads core user for non-admin ask to apply multi-agent plan clamp", async () => {
    identityMocks.getCoreUserById.mockResolvedValueOnce({
      subscriptionPlan: "premium_plus",
      billing: {
        override: {
          enabled: true
        }
      }
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

  it("downgrades multi-agent persona to default chat model when the turn is simple and reasoningEffort is omitted", async () => {
    repositoryMocks.resolveDefaultXchatPersonaForSession.mockResolvedValueOnce(
      buildPersona({ model: "grok-4.20-multi-agent" })
    );
    const response = await postAsk(
      new Request("http://test/api/xchat/ask", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: "What is 2+2?" })
      })
    );
    expect(response.status).toBe(200);
    const toolLoopArg = xaiMocks.respondWithXaiToolLoop.mock.calls[0]?.[0] as {
      model?: string;
      parallelism?: unknown;
    };
    expect(toolLoopArg?.model).toBe("grok-4-1-fast");
    expect(toolLoopArg?.parallelism).toBeUndefined();
  });

  it("returns strategy job preflight without xAI for clear multi-leg / options-strategy intent", async () => {
    const response = await postAsk(
      new Request("http://test/api/xchat/ask", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: "I want to structure a covered call on AAPL for income"
        })
      })
    );
    expect(response.status).toBe(200);
    const payload = (await response.json()) as { data?: { strategyJobOffer?: boolean } };
    expect(payload.data?.strategyJobOffer).toBe(true);
    expect(xaiMocks.respondWithXaiToolLoop).not.toHaveBeenCalled();
    expect(repositoryMocks.saveXChatLog).toHaveBeenCalledWith(
      expect.objectContaining({ model: "strategy_job_preflight" })
    );
  });

  it("respects per-thread stay-in-chat opt-out and does not re-offer strategy jobs", async () => {
    repositoryMocks.getLatestXchatLogByThread
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ strategyJobOptOut: false })
      .mockResolvedValueOnce({ strategyJobOptOut: true });

    const threadId = "thread_optout_1";

    const first = await postAsk(
      new Request("http://test/api/xchat/ask", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          threadId,
          message: "covered call ideas for RDW"
        })
      })
    );
    expect(first.status).toBe(200);
    const firstPayload = (await first.json()) as { data?: { strategyJobOffer?: boolean } };
    expect(firstPayload.data?.strategyJobOffer).toBe(true);

    const second = await postAsk(
      new Request("http://test/api/xchat/ask", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          threadId,
          message: "stay in chat"
        })
      })
    );
    expect(second.status).toBe(200);
    const secondPayload = (await second.json()) as {
      data?: {
        response?: string;
        content?: string;
        strategyJobOffer?: boolean;
        interactionMeta?: { generationMs: number; sources: { total: number } };
        metadata?: {
          durationMs: number;
          sourcesUsed: number;
          personaId: string;
          model: string;
          threadId: string;
        };
      };
    };
    expect(secondPayload.data?.strategyJobOffer).toBe(false);
    expect(secondPayload.data?.response ?? "").toContain("Understood, staying in chat");
    expect(secondPayload.data?.content ?? "").toContain("Understood, staying in chat");
    expect(secondPayload.data?.content).toBe(secondPayload.data?.response);
    expect(secondPayload.data?.metadata?.threadId).toBe(threadId);
    expect(secondPayload.data?.metadata?.model).toBe("strategy_job_opt_out");
    expect(secondPayload.data?.metadata?.personaId).toBe("507f1f77bcf86cd799439055");
    expect(secondPayload.data?.metadata?.durationMs).toBe(secondPayload.data?.interactionMeta?.generationMs);
    expect(secondPayload.data?.metadata?.sourcesUsed).toBe(secondPayload.data?.interactionMeta?.sources.total);

    const third = await postAsk(
      new Request("http://test/api/xchat/ask", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          threadId,
          message: "covered call ideas for RDW"
        })
      })
    );
    expect(third.status).toBe(200);
    const thirdPayload = (await third.json()) as { data?: { strategyJobOffer?: boolean } };
    expect(thirdPayload.data?.strategyJobOffer).toBeFalsy();
    expect(xaiMocks.respondWithXaiToolLoop).toHaveBeenCalledWith(
      expect.objectContaining({
        systemPrompt: expect.stringContaining(
          "User has explicitly chosen to stay in normal chat mode. Do NOT offer or mention strategy jobs, xStrategyBuilder, or the Spring orchestrator again in this conversation. Answer directly using tools, RAG, and portfolio context only. Keep full conversation history."
        )
      })
    );
  });

  it("re-detects strategy intent in a new thread after opt-out in a previous thread", async () => {
    repositoryMocks.getLatestXchatLogByThread.mockResolvedValueOnce(null);
    const response = await postAsk(
      new Request("http://test/api/xchat/ask", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          threadId: "thread_fresh_2",
          message: "covered call ideas for RDW"
        })
      })
    );
    expect(response.status).toBe(200);
    const payload = (await response.json()) as { data?: { strategyJobOffer?: boolean } };
    expect(payload.data?.strategyJobOffer).toBe(true);
    expect(xaiMocks.respondWithXaiToolLoop).not.toHaveBeenCalled();
  });

  it("serves show-my-watchlist via direct atx_function snapshot and enumerates all symbols", async () => {
    const createSpy = vi.spyOn(toolExecutorModule, "createXfinanceToolExecutor");
    repositoryMocks.resolveDefaultXchatPersonaForSession.mockResolvedValueOnce(
      buildPersona({
        xapi: {
          mode: "responses",
          toolChoice: "auto",
          maxTurns: 5,
          tools: [{ type: "atx_function" }]
        }
      })
    );
    symbolLookupMocks.lookupSymbols.mockResolvedValueOnce(
      new Map([
        [
          "TSLA",
          {
            symbol: "TSLA",
            price: 245,
            change: 5.25,
            changePercent: 2.19,
            source: "yahoo-finance2"
          }
        ],
        [
          "NVDA",
          {
            symbol: "NVDA",
            price: 488,
            change: -3.1,
            changePercent: -0.63,
            source: "yahoo-finance2"
          }
        ]
      ])
    );
    createSpy.mockReturnValueOnce(
      (async () => ({
        result: JSON.stringify({
          name: "Default Watchlist",
          symbolCount: 2,
          symbols: [
            {
              symbol: "TSLA",
              spotPriceDisplay: "$245.00",
              targetEntryNotional100xUsdDisplay: "$24,500",
              targetEntryNotional100xDisplay: "24,500"
            },
            {
              symbol: "NVDA",
              spotPriceDisplay: "$488.00",
              targetEntryNotional100xUsdDisplay: "$48,800",
              targetEntryNotional100xDisplay: "48,800",
              targetEntryPrice: 120.5
            }
          ]
        })
      })) as never
    );
    try {
      const response = await postAsk(
        new Request("http://test/api/xchat/ask", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            message: "show my watchlist",
            portfolioId: "507f1f77bcf86cd799439044"
          })
        })
      );
      expect(response.status).toBe(200);
      const payload = (await response.json()) as { data?: { response?: string; model?: string } };
      expect(payload.data?.model).toBe("watchlist_snapshot_direct");
      const text = payload.data?.response ?? "";
      expect(text).toContain("TSLA");
      expect(text).toContain("NVDA");
      expect(text).toContain("| Symbol | Spot | 1D Delta | Distance to Target | xOptions CTA |");
      expect(text).toContain("| TSLA | $245.00 | +$5.25 (+2.19%)");
      expect(text).toContain("| NVDA | $488.00 | -$3.10 (-0.63%)");
      expect(text).toContain(
        "[Open TSLA in xOptions](/xoptions?symbol=TSLA&action=build&portfolioId=507f1f77bcf86cd799439044"
      );
      expect(text).toContain(
        "[Open NVDA in xOptions](/xoptions?symbol=NVDA&action=build&portfolioId=507f1f77bcf86cd799439044"
      );
      expect(text).toContain("Accessibility note:");
      expect(text).not.toMatch(/added /i);
      expect(xaiMocks.respondWithXaiToolLoop).not.toHaveBeenCalled();
      expect(createSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          workspacePortfolioId: "507f1f77bcf86cd799439044"
        })
      );
    } finally {
      createSpy.mockRestore();
    }
  });

  it("asks for portfolioId slot before direct watchlist response when user says show watchlist for [portfolio]", async () => {
    const createSpy = vi.spyOn(toolExecutorModule, "createXfinanceToolExecutor");
    repositoryMocks.resolveDefaultXchatPersonaForSession.mockResolvedValueOnce(
      buildPersona({
        xapi: {
          mode: "responses",
          toolChoice: "auto",
          maxTurns: 5,
          tools: [{ type: "atx_function" }]
        }
      })
    );
    try {
      const response = await postAsk(
        new Request("http://test/api/xchat/ask", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            message: "show watchlist for growth portfolio"
          })
        })
      );
      expect(response.status).toBe(200);
      const payload = (await response.json()) as { data?: { response?: string; model?: string } };
      expect(payload.data?.model).toBe("watchlist_portfolio_slot_collection");
      expect(payload.data?.response ?? "").toContain("Please share the `portfolioId`");
      expect(createSpy).not.toHaveBeenCalled();
      expect(xaiMocks.respondWithXaiToolLoop).not.toHaveBeenCalled();
    } finally {
      createSpy.mockRestore();
    }
  });

  it("extracts inline portfolioId from show-watchlist ask and runs direct route without slot prompt", async () => {
    const createSpy = vi.spyOn(toolExecutorModule, "createXfinanceToolExecutor");
    repositoryMocks.resolveDefaultXchatPersonaForSession.mockResolvedValueOnce(
      buildPersona({
        xapi: {
          mode: "responses",
          toolChoice: "auto",
          maxTurns: 5,
          tools: [{ type: "atx_function" }]
        }
      })
    );
    symbolLookupMocks.lookupSymbols.mockResolvedValueOnce(
      new Map([
        [
          "TSLA",
          {
            symbol: "TSLA",
            price: 245,
            change: 1.25,
            changePercent: 0.51,
            source: "yahoo-finance2"
          }
        ]
      ])
    );
    createSpy.mockReturnValueOnce(
      (async () => ({
        result: JSON.stringify({
          name: "Growth Watchlist",
          symbolCount: 1,
          symbols: [
            {
              symbol: "TSLA",
              spotPriceDisplay: "$245.00",
              targetEntryNotional100xUsdDisplay: "$24,500"
            }
          ]
        })
      })) as never
    );
    try {
      const response = await postAsk(
        new Request("http://test/api/xchat/ask", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            message: "show watchlist for 507f1f77bcf86cd799439044"
          })
        })
      );
      expect(response.status).toBe(200);
      const payload = (await response.json()) as { data?: { response?: string; model?: string } };
      expect(payload.data?.model).toBe("watchlist_snapshot_direct");
      expect(payload.data?.response ?? "").not.toContain("Please share the `portfolioId`");
      expect(createSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          workspacePortfolioId: "507f1f77bcf86cd799439044"
        })
      );
      expect(payload.data?.response ?? "").toContain(
        "[Open TSLA in xOptions](/xoptions?symbol=TSLA&action=build&portfolioId=507f1f77bcf86cd799439044"
      );
    } finally {
      createSpy.mockRestore();
    }
  });

  it("keeps enhanced watchlist table when market pulse data is missing", async () => {
    const createSpy = vi.spyOn(toolExecutorModule, "createXfinanceToolExecutor");
    repositoryMocks.resolveDefaultXchatPersonaForSession.mockResolvedValueOnce(
      buildPersona({
        xapi: {
          mode: "responses",
          toolChoice: "auto",
          maxTurns: 5,
          tools: [{ type: "atx_function" }]
        }
      })
    );
    symbolLookupMocks.lookupSymbols.mockResolvedValueOnce(new Map());
    createSpy.mockReturnValueOnce(
      (async () => ({
        result: JSON.stringify({
          name: "Fallback Watchlist",
          symbolCount: 1,
          symbols: [
            {
              symbol: "TSLA",
              spotPriceDisplay: "$245.00",
              targetEntryNotional100xUsdDisplay: "$24,500"
            }
          ]
        })
      })) as never
    );
    try {
      const response = await postAsk(
        new Request("http://test/api/xchat/ask", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            message: "show my watchlist",
            portfolioId: "507f1f77bcf86cd799439044"
          })
        })
      );
      expect(response.status).toBe(200);
      const payload = (await response.json()) as { data?: { response?: string } };
      const text = payload.data?.response ?? "";
      expect(text).toContain("| Symbol | Spot | 1D Delta | Distance to Target | xOptions CTA |");
      expect(text).toContain("| TSLA | $245.00 | — | — |");
      expect(text).toContain(
        "[Open TSLA in xOptions](/xoptions?symbol=TSLA&action=build&portfolioId=507f1f77bcf86cd799439044"
      );
    } finally {
      createSpy.mockRestore();
    }
  });

  it("routes options_scan to direct deterministic options action scan", async () => {
    const createSpy = vi.spyOn(toolExecutorModule, "createXfinanceToolExecutor");
    repositoryMocks.resolveDefaultXchatPersonaForSession.mockResolvedValueOnce(
      buildPersona({
        xapi: {
          mode: "responses",
          toolChoice: "auto",
          maxTurns: 5,
          tools: [{ type: "atx_function" }]
        }
      })
    );
    createSpy.mockReturnValueOnce(
      (async () => ({
        result: JSON.stringify({
          markdown:
            "### Options action scan\n\n| source | symbol | strike | exp | type | qty | action | why | urgency | target_window | confidence |\n|---|---|---:|---|---|---:|---|---|---|---|---|\n| holding | TSLA | 250.00 | 2026-05-01 | call | -1 | ROLL | Assignment risk elevated. | high | this week | high |",
          rows: [
            {
              source: "holding",
              symbol: "TSLA",
              strike: 250,
              exp: "2026-05-01",
              type: "call",
              qty: -1,
              recommendedAction: "ROLL",
              why: "Assignment risk elevated.",
              urgency: "high",
              targetWindow: "this week",
              confidence: "high"
            }
          ],
          truncated: false
        })
      })) as never
    );
    const response = await postAsk(
      new Request("http://test/api/xchat/ask", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: "scan my options holdings"
        })
      })
    );
    expect(response.status).toBe(200);
    const payload = (await response.json()) as { data?: { model?: string; response?: string } };
    expect(payload.data?.model).toBe("options_action_scan_direct");
    expect(payload.data?.response ?? "").toContain("Options action scan");
    expect(xaiMocks.respondWithXaiToolLoop).not.toHaveBeenCalled();
    expect(optionsScanReportMocks.createOptionsScanReport).toHaveBeenCalled();
    expect(identityMocks.updateCoreUserOptionsScanPreferences).toHaveBeenCalled();
    expect(createSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        subscriptionPlan: undefined
      })
    );
    createSpy.mockRestore();
  });

  it("processes watchlist mutate intents without returning confirmation gate copy", async () => {
    const response = await postAsk(
      new Request("http://test/api/xchat/ask", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: "add NVDA to my watchlist"
        })
      })
    );
    expect(response.status).toBe(200);
    const payload = (await response.json()) as {
      data?: { needsMutationConfirm?: boolean; response?: string };
    };
    expect(payload.data?.needsMutationConfirm).not.toBe(true);
    expect(payload.data?.response).toBe("xAI answer");
    expect(xaiMocks.respondWithXaiToolLoop).toHaveBeenCalled();
  });

});
