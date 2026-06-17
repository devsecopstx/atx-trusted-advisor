import { ObjectId } from "mongodb";
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

const visionProcessorMocks = vi.hoisted(() => ({
  processDecodedXchatVisionImage: vi.fn()
}));

const visionCaptionMocks = vi.hoisted(() => ({
  generateXchatVisionAutoCaption: vi.fn()
}));

const imageAttachRepoMocks = vi.hoisted(() => ({
  insertXchatImageAttachmentRows: vi.fn()
}));

const portfolioHintMocks = vi.hoisted(() => ({
  resolvePortfolioHintFromNl: vi.fn()
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
vi.mock("@/modules/xchat/vision-processor", () => ({
  processDecodedXchatVisionImage: visionProcessorMocks.processDecodedXchatVisionImage
}));
vi.mock("@/modules/xchat/xchat-vision-auto-caption", () => ({
  generateXchatVisionAutoCaption: visionCaptionMocks.generateXchatVisionAutoCaption
}));
vi.mock("@/modules/xchat/xchat-image-attachments-repository", () => ({
  insertXchatImageAttachmentRows: imageAttachRepoMocks.insertXchatImageAttachmentRows
}));
vi.mock("@/modules/price-alerts/resolve-portfolio-hint", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/modules/price-alerts/resolve-portfolio-hint")>();
  return {
    ...actual,
    resolvePortfolioHintFromNl: portfolioHintMocks.resolvePortfolioHintFromNl
  };
});

vi.mock("@/lib/xai-default-persona-model", () => ({
  getDefaultPersonaChatModelId: () => "grok-4-1-fast-reasoning"
}));

import { POST as postAsk } from "@/app/api/xchat/ask/route";

import {
  MAX_XCHAT_PASTE_IMAGE_BYTES,
  mergeRawAskImageAttachmentsFromAskPayload,
  parseAndValidateXchatPasteImage
} from "@/modules/xchat/xchat-image-attachment";

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

const tinyPngBase64 =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";

describe("xchat vision paste (POST /api/xchat/ask)", () => {
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
    visionProcessorMocks.processDecodedXchatVisionImage.mockImplementation(
      async (input: { decoded: Buffer; declaredMediaType: "image/png" | "image/jpeg" }) => ({
        ok: true,
        value: {
          mediaType: input.declaredMediaType,
          dataUrl: `data:${input.declaredMediaType};base64,${input.decoded.toString("base64")}`,
          byteLength: input.decoded.length,
          originalSha256Hex: "0".repeat(64),
          processedSha256Hex: "1".repeat(64),
          contentFingerprint: "abcdef0123456789abcdef01",
          width: 2,
          height: 2
        }
      })
    );
    visionCaptionMocks.generateXchatVisionAutoCaption.mockResolvedValue("auto-caption");
    imageAttachRepoMocks.insertXchatImageAttachmentRows.mockResolvedValue(undefined);
    portfolioHintMocks.resolvePortfolioHintFromNl.mockResolvedValue({
      ok: false,
      error: "not_found"
    });
  });

  it("happy path: accepts imageAttachment and forwards a data URL to respondWithXaiToolLoop", async () => {
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
      userImageDataUrls?: string[];
      model?: string;
    };
    expect(call?.userImageDataUrls?.[0]?.startsWith("data:image/png;base64,")).toBe(true);
    expect(call?.model).toBe("grok-4-1-fast");
  });

  it("uses XAI_VISION_MODEL for image turns when set", async () => {
    vi.stubEnv("XAI_VISION_MODEL", "grok-4.20-reasoning");
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

  it("multi-image: accepts imageAttachments and forwards userImageDataUrls", async () => {
    const response = await postAsk(
      new Request("http://test/api/xchat/ask", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          personaId: "507f1f77bcf86cd799439055",
          message: "Compare these.",
          imageAttachments: [
            { mediaType: "image/png", dataBase64: tinyPngBase64 },
            { mediaType: "image/png", dataBase64: tinyPngBase64 }
          ],
          topK: 4
        })
      })
    );
    expect(response.status).toBe(200);
    const call = xaiMocks.respondWithXaiToolLoop.mock.calls.at(-1)?.[0] as {
      userImageDataUrls?: string[];
    };
    expect(call?.userImageDataUrls?.length).toBe(2);
    expect(imageAttachRepoMocks.insertXchatImageAttachmentRows).toHaveBeenCalled();
  });

  it("virus-positive: rejects with 422 and audit", async () => {
    visionProcessorMocks.processDecodedXchatVisionImage.mockResolvedValueOnce({
      ok: false,
      code: "vision_threat_detected",
      error: "Attachment rejected by virus scan."
    });
    const response = await postAsk(
      new Request("http://test/api/xchat/ask", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          personaId: "507f1f77bcf86cd799439055",
          message: "Describe",
          imageAttachment: { mediaType: "image/png", dataBase64: tinyPngBase64 },
          topK: 4
        })
      })
    );
    expect(response.status).toBe(422);
    const body = (await response.json()) as { code?: string };
    expect(body.code).toBe("vision_threat_detected");
    expect(auditMocks.createAuditEvent).toHaveBeenCalled();
  });

  it("oversized / pipeline fail: returns 400 vision_process_failed when processor rejects", async () => {
    visionProcessorMocks.processDecodedXchatVisionImage.mockResolvedValueOnce({
      ok: false,
      code: "vision_process_failed",
      error: "Could not process image: fail"
    });
    const response = await postAsk(
      new Request("http://test/api/xchat/ask", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          personaId: "507f1f77bcf86cd799439055",
          message: "Describe",
          imageAttachment: { mediaType: "image/png", dataBase64: tinyPngBase64 },
          topK: 4
        })
      })
    );
    expect(response.status).toBe(400);
    const body = (await response.json()) as { code?: string };
    expect(body.code).toBe("vision_process_failed");
  });
});

describe("xchat vision paste (payload helpers)", () => {
  it("mergeRawAskImageAttachmentsFromAskPayload merges legacy + list and caps at 4", () => {
    const merged = mergeRawAskImageAttachmentsFromAskPayload({
      legacy: { mediaType: "image/png", dataBase64: "YQ==" },
      list: [
        { mediaType: "image/png", dataBase64: "Yg==" },
        { mediaType: "image/png", dataBase64: "Yw==" },
        { mediaType: "image/png", dataBase64: "ZA==" },
        { mediaType: "image/png", dataBase64: "ZQ==" }
      ]
    });
    expect(merged).toHaveLength(4);
    expect(merged[0]?.dataBase64).toBe("YQ==");
  });

  it("parseAndValidateXchatPasteImage rejects decoded bytes over cap (oversized paste)", () => {
    const buf = Buffer.alloc(MAX_XCHAT_PASTE_IMAGE_BYTES + 1, 7);
    const res = parseAndValidateXchatPasteImage({
      mediaType: "image/png",
      dataBase64: buf.toString("base64")
    });
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.error).toMatch(/maximum decoded size/i);
    }
  });
});
