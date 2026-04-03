import { ObjectId } from "mongodb";
import { NextResponse } from "next/server";
import { createHash } from "node:crypto";
import { z } from "zod";

import { preprocessXchatMarkdown } from "@/app/xchat/ui/xchat-markdown-preprocess";
import { requireSessionUser } from "@/lib/auth";
import {
    getPersonaByIdCached,
    getTenantByHexIdCached,
    loadDefaultXchatPersonaForSessionDeduped
} from "@/lib/server-request-cache";
import { effectiveWorkspaceLimitsForTenantAndPlan } from "@/lib/tenant-workspace-limits";
import {
    respondWithXaiToolLoop,
    searchDocumentsInCollections,
    type ToolCallLog
} from "@/lib/xai";
import { getDefaultPersonaChatModelId } from "@/lib/xai-default-persona-model";
import { buildWireToolsForXaiResponses, personaXapiToolsToXaiRequestTools } from "@/lib/xai-tools";
import {
    logXchatAskDebug,
    logXchatAskFullPayload,
    logXchatAskPreRequestDebug,
    logXchatAskProviderErrorDebug
} from "@/lib/xchat-debug";
import { runWithXchatTenantDebugAsync } from "@/lib/xchat-debug-context";
import { createAuditEvent } from "@/modules/audit/repository";
import { getUserAdminSettings } from "@/modules/core-admin/repository";
import { isGlobalAdmin } from "@/modules/identity/authorization";
import { getCoreUserById } from "@/modules/identity/repository";
import { isTenantXchatDebugPreferenceEnabled } from "@/modules/identity/tenant-branding-preferences";
import type { SubscriptionPlan } from "@/modules/identity/types";
import { enforceDistributedAskUsageLimit } from "@/modules/xchat/ask-usage-limits";
import { appendXchatKbMetadata } from "@/modules/xchat/batch-prompt-context";
import { XPERSONA_SUPER_AGENT_NAME } from "@/modules/xchat/default-xpersonas";
import {
    resolveXchatTeamOnlyLinkedCollectionIds,
    withLinkedCollectionTools
} from "@/modules/xchat/persona-linked-collections";
import {
    clampMultiAgentParallelismForPlan,
    clampTopK,
    getPlanLimits
} from "@/modules/xchat/plan-limits";
import { getScopeReadinessSummary } from "@/modules/xchat/rag-file-readiness";
import { getLatestXchatResponseIdByUser, saveXChatLog } from "@/modules/xchat/repository";
import { createXfinanceToolExecutor } from "@/modules/xchat/tool-executor";
import { fireAndForgetRecordXchatToolUsage } from "@/modules/xchat/tool-usage-repository";
import {
    ensureSuperAgentDefaultTools,
    isAtxFunctionToolType,
    mergeXchatHostedToolBaseline,
    normalizePersonaXapiConfig,
    type PersonaXapiConfig
} from "@/modules/xchat/types";
import {
    formatWorkspaceServerSnapshotBlock,
    loadWorkspaceSnapshotPreload,
    type WorkspaceSnapshotPreload
} from "@/modules/xchat/workspace-snapshot-for-prompt";
import { verifyXaiCollectionNonBlocking } from "@/modules/xchat/xai-collection-verifier";
import { isXchatRemoteHistoryEnabled } from "@/modules/xchat/xchat-platform-settings";
import { buildSessionToolInstructions, buildXchatSystemPrompt } from "@/modules/xchat/xchat-prompt-build";

const askSchema = z.object({
  message: z.string().min(2).max(8_000),
  personaId: z.string().optional(),
  reasoningEffort: z.enum(["low", "medium", "high", "xhigh"]).optional(),
  scope: z.string().min(1).max(128).optional(),
  topK: z.number().int().min(1).max(10).optional()
});

const MAX_ASK_PAYLOAD_BYTES = 24 * 1024;
const ASK_RATE_MAX = 20;
const MULTI_AGENT_MODELS = new Set(["grok-4.20-multi-agent", "grok-4.20-multi-agent-0309"]);
const APP_USER_BLOCKED_PERSONA_KEYS = new Set<string>([
  normalizeNameKey(XPERSONA_SUPER_AGENT_NAME)
]);

type ModelSelectionSource = "default" | "persona";
type RequestedReasoningEffort = "low" | "medium" | "high" | "xhigh";
type ParallelReasoningEffort = "low" | "medium" | "high";

type ParallelAgentConfig = {
  agentCount: 4 | 16;
  reasoningEffort: ParallelReasoningEffort;
};

type AskPersonaAccessResult =
  | { ok: true }
  | {
      ok: false;
      status: number;
      error: string;
      code: string;
    };

export async function POST(request: Request) {
  const session = await requireSessionUser();
  if (session instanceof NextResponse) {
    return session;
  }

  const tenantForDebug = ObjectId.isValid(session.tenantId)
    ? await getTenantByHexIdCached(session.tenantId)
    : null;
  const tenantDebugFlag = isTenantXchatDebugPreferenceEnabled(tenantForDebug);

  return runWithXchatTenantDebugAsync(tenantDebugFlag, async () => {
  const contentLength = Number(request.headers.get("content-length") ?? "0");
  if (Number.isFinite(contentLength) && contentLength > MAX_ASK_PAYLOAD_BYTES) {
    return NextResponse.json({ error: "Payload too large" }, { status: 413 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON payload" }, { status: 400 });
  }

  const parsed = askSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid ask payload", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const { message } = parsed.data;
  const isAdminSession = isGlobalAdmin(session.roles);
  let subscriptionPlan: SubscriptionPlan | undefined;
  let limiterRemainingMinute: number | undefined;
  let limiterRemainingDay: number | undefined;
  let limiterDailyLimit: number | undefined;
  if (!isAdminSession && ObjectId.isValid(session.userId)) {
    const coreUser = await getCoreUserById(new ObjectId(session.userId));
    subscriptionPlan = coreUser?.subscriptionPlan;
  }
  const requestedTopK = parsed.data.topK ?? 4;
  const topK = isAdminSession ? requestedTopK : clampTopK(requestedTopK, subscriptionPlan);
  let dailyPromptCap: number | undefined;
  if (!isAdminSession) {
    const workspaceLimits = effectiveWorkspaceLimitsForTenantAndPlan(tenantForDebug, subscriptionPlan);
    const planDaily = getPlanLimits(subscriptionPlan).maxPromptsPerDay;
    dailyPromptCap = Math.min(planDaily, workspaceLimits.userChatLimit);
  }
  try {
    const usageCheck = await enforceDistributedAskUsageLimit({
      userId: session.userId,
      tenantId: session.tenantId,
      plan: subscriptionPlan,
      perMinuteLimit: ASK_RATE_MAX,
      enforceDailyLimit: !isAdminSession,
      dailyPromptLimit: dailyPromptCap
    });
    if (!usageCheck.allowed) {
      const limiterHeaders = buildLimiterHeaders({
        remainingMinute: usageCheck.remainingMinute,
        remainingDay: usageCheck.remainingDay,
        dailyLimit: usageCheck.dailyLimit,
        retryAfterSeconds: usageCheck.retryAfterSeconds
      });
      return NextResponse.json(
        {
          error:
            usageCheck.code === "xchat_daily_limit_exceeded"
              ? "xChat prompt limit reached for your current plan (per-hour cap on billing; usage window may reset on UTC day)"
              : "Rate limit exceeded",
          code: usageCheck.code,
          retryAfterSeconds: usageCheck.retryAfterSeconds ?? 60
        },
        { status: 429, headers: limiterHeaders }
      );
    }
    limiterRemainingMinute = usageCheck.remainingMinute;
    limiterRemainingDay = usageCheck.remainingDay;
    limiterDailyLimit = usageCheck.dailyLimit;
  } catch (error) {
    console.error("[xchat/ask] distributed usage limit check failed", {
      userId: session.userId,
      error: error instanceof Error ? error.message : String(error)
    });
    return NextResponse.json(
      {
        error: "xChat usage limiter is unavailable",
        retryable: true
      },
      { status: 503 }
    );
  }

  const defaultPersona = await loadDefaultXchatPersonaForSessionDeduped(session.roles);
  if (!defaultPersona) {
    return NextResponse.json(
      {
        error:
          "Default xChat persona is unavailable. For admins, seed Super-Agent (`npm run seed:admin`). For app users, ensure the atx-trusted-advisor persona exists (Admin → Personas) or run `npm run seed:xpersonas`."
      },
      { status: 503 }
    );
  }
  let persona = defaultPersona;
  const userSettings = await getUserAdminSettings(session.userId, {
    tenantId: session.tenantId
  });
  const requestedPersonaId = parsed.data.personaId?.trim();
  const assignedPersonaId = userSettings?.assignedPersonaId?.trim();
  const hasAppRole = session.roles.some((role) =>
    role === "advisor" || role === "operator" || role === "viewer"
  );
  const workspaceLimitsForPersona = effectiveWorkspaceLimitsForTenantAndPlan(
    tenantForDebug,
    subscriptionPlan
  );
  const allowRequestPersonaOverride =
    isAdminSession || workspaceLimitsForPersona.changePersonaEnabled;
  const personaOverrideCandidates = (() => {
    if (!allowRequestPersonaOverride) {
      if (assignedPersonaId) {
        return [assignedPersonaId];
      }
      return [];
    }
    const effectivePersonaId = assignedPersonaId || requestedPersonaId;
    if (requestedPersonaId && assignedPersonaId && requestedPersonaId !== assignedPersonaId) {
      return [requestedPersonaId, assignedPersonaId];
    }
    return effectivePersonaId ? [effectivePersonaId] : [];
  })();
  let resolvedPersonaIdOverride: string | undefined;
  for (const candidatePersonaId of personaOverrideCandidates) {
    const requestedPersona = await getPersonaByIdCached(candidatePersonaId);
    if (!requestedPersona) {
      const isAssignedCandidate = Boolean(
        assignedPersonaId && candidatePersonaId === assignedPersonaId
      );
      if (isAssignedCandidate) {
        console.warn("[xchat/ask] assigned persona missing; falling back", {
          userId: session.userId,
          assignedPersonaId: candidatePersonaId
        });
        continue;
      }
      return NextResponse.json(
        { error: "Persona not found", code: "persona_not_found" },
        { status: 404 }
      );
    }
    const access = canSessionUsePersona({
      isAdminSession,
      hasAppRole,
      personaName: requestedPersona.name,
      personaStatus: requestedPersona.status,
      isAssignedPersona: Boolean(assignedPersonaId && candidatePersonaId === assignedPersonaId)
    });
    if (!access.ok) {
      return NextResponse.json(
        { error: access.error, code: access.code },
        { status: access.status }
      );
    }
    persona = requestedPersona;
    resolvedPersonaIdOverride = candidatePersonaId;
    break;
  }

  const personaModelRaw =
    typeof persona?.model === "string" ? persona.model.trim().slice(0, 128) : "";
  const effectiveModel =
    personaModelRaw.length > 0 ? personaModelRaw : getDefaultPersonaChatModelId();
  const modelSelectionSource: ModelSelectionSource =
    personaModelRaw.length > 0 ? "persona" : "default";

  const parallelAgentConfigResult = resolveParallelAgentConfig({
    model: effectiveModel,
    reasoningEffort: parsed.data.reasoningEffort
  });
  if (!parallelAgentConfigResult.ok) {
    return NextResponse.json(
      {
        error: parallelAgentConfigResult.error,
        code: parallelAgentConfigResult.code
      },
      { status: 400 }
    );
  }
  let parallelAgentConfig = parallelAgentConfigResult.config;
  if (!isAdminSession) {
    parallelAgentConfig = clampMultiAgentParallelismForPlan(
      parallelAgentConfig,
      subscriptionPlan
    );
  }

  const baseXapiConfig: PersonaXapiConfig = ensureSuperAgentDefaultTools(
    normalizePersonaXapiConfig(persona?.xapi),
    persona?.name
  );
  const scope = parsed.data.scope ?? persona?.defaultScope ?? "global";
  const requestId = buildDeterministicId(
    "xreq",
    session.userId,
    session.tenantId ?? "tenant:none",
    resolvedPersonaIdOverride ?? persona?._id?.toHexString() ?? persona?.name ?? "persona:none",
    message,
    effectiveModel,
    scope
  );
  const correlationId = buildDeterministicId(
    "xcorr",
    requestId,
    session.userId,
    session.tenantId ?? "tenant:none"
  );
  const tenantId = ObjectId.isValid(session.tenantId)
    ? new ObjectId(session.tenantId)
    : null;
  const userId = ObjectId.isValid(session.userId)
    ? new ObjectId(session.userId)
    : undefined;
  /** RAG / file_search for ask: TEAM KB only (`teamCollection` + deploy team default). */
  const linkedCollectionIds = await resolveXchatTeamOnlyLinkedCollectionIds(persona);
  for (const collectionId of linkedCollectionIds) {
    verifyXaiCollectionNonBlocking(collectionId);
  }
  const xapiConfig = mergeXchatHostedToolBaseline(
    withLinkedCollectionTools(baseXapiConfig, linkedCollectionIds)
  );

  let contextSource: "none" | "xai_collection" = "none";
  let collectionContextReferences: Array<{
    documentId?: string;
    documentName?: string;
    snippetFingerprint: string;
  }> = [];
  let ragContext = "";
  let contextCount = 0;
  let collectionSearchStatus: "ready" | "blocked_non_ready_files" | "skipped_no_collections" = "ready";
  let collectionSearchNonReadyFileCount = 0;

  if (persona?.enableRag !== false) {
    if (linkedCollectionIds.length > 0) {
      const readinessSummary = await getScopeReadinessSummary({
        scope,
        tenantId: tenantId ?? undefined,
        linkedCollectionIds
      });
      collectionSearchNonReadyFileCount = readinessSummary.nonReadyFiles.length;
      if (readinessSummary.blocked) {
        collectionSearchStatus = "blocked_non_ready_files";
      }
    } else {
      collectionSearchStatus = "skipped_no_collections";
    }

    if (linkedCollectionIds.length > 0 && collectionSearchStatus === "ready") {
      try {
        const collectionSnippets = await searchDocumentsInCollections({
          query: message,
          collectionIds: linkedCollectionIds,
          limit: topK
        });
        if (collectionSnippets.length > 0) {
          contextSource = "xai_collection";
          contextCount = collectionSnippets.length;
          collectionContextReferences = collectionSnippets.map((snippet) => ({
            documentId: snippet.documentId,
            documentName: snippet.documentName,
            snippetFingerprint: createSnippetFingerprint(snippet.text)
          }));
          ragContext = collectionSnippets
            .map((snippet, index) => {
              const source = snippet.documentName ?? snippet.documentId ?? "collection_doc";
              return `[#${index + 1}] (${source}) ${snippet.text}`;
            })
            .join("\n\n");
        }
      } catch (error) {
        console.error(
          `[xchat/ask] xAI collection search failed for ${linkedCollectionIds.join(",")}:`,
          error instanceof Error ? error.message : error
        );
      }
    }

  }

  const hasXfinanceTool = xapiConfig.tools.some((t) => isAtxFunctionToolType(t.type));
  const hasYahooFinanceTool = xapiConfig.tools.some((t) => t.type === "yahoo_finance");
  /** Custom tools must run through `respondWithXaiToolLoop`; `chatWithXai` does not execute tool_calls. */
  const needsLocalToolLoop = hasXfinanceTool || hasYahooFinanceTool;
  /**
   * Keep one execution workflow to avoid live-search drift: all asks use the multi-turn Responses
   * tool loop, regardless of persona xapi.mode, so hosted and local tools share identical handling.
   */
  const hasHostedSearchTool = xapiConfig.tools.some((t) => t.type === "web_search" || t.type === "x_search");

  let workspaceServerSnapshot: string | null = null;
  let workspacePreload: WorkspaceSnapshotPreload | null = null;
  if (hasXfinanceTool) {
    try {
      workspacePreload = await loadWorkspaceSnapshotPreload({
        userId: session.userId,
        tenantId: session.tenantId
      });
      workspaceServerSnapshot = workspacePreload
        ? formatWorkspaceServerSnapshotBlock(workspacePreload)
        : null;
    } catch (error) {
      console.warn("[xchat/ask] workspace server snapshot failed (non-fatal)", {
        userId: session.userId,
        message: error instanceof Error ? error.message : String(error)
      });
    }
  }

  const useRemoteConversationHistory =
    isXchatRemoteHistoryEnabled() && persona?.keepXchatHistory !== false;
  let previousResponseId: string | undefined;
  if (useRemoteConversationHistory && userId) {
    try {
      const latest = await getLatestXchatResponseIdByUser({
        userId,
        tenantId,
        personaId: persona?._id
      });
      previousResponseId = latest ?? undefined;
    } catch (error) {
      console.warn("[xchat/ask] remote history lookup failed (non-fatal)", {
        userId: session.userId,
        message: error instanceof Error ? error.message : String(error)
      });
    }
  }

  const teamKbMetaLine =
    linkedCollectionIds.length > 0
      ? `xChat TEAM KB xAI collection ids (persona.teamCollection + deploy default; single team model — no per-user history collection): ${linkedCollectionIds.join(", ")}`
      : "xChat TEAM KB xAI collection ids: (none — set persona teamCollection and/or team KB / XAI_TEAM_ID so RAG can run)";

  const systemPrompt = buildXchatSystemPrompt({
    personaSystem: persona?.systemPrompt ?? "",
    fallbackPersonaSystem: "You are xchat, an operations-focused assistant for atxfinance core admins.",
    ragContext,
    recentHistoryBlock: null,
    workspaceSnapshot: workspaceServerSnapshot,
    sessionToolInstructions: buildSessionToolInstructions({
      hostedSearch: hasHostedSearchTool,
      atxFunction: hasXfinanceTool
    }),
    citationsEnabled: persona?.citationsEnabled !== false
  });
  const userPromptTemplate = persona?.overridePrompt?.trim() ?? "";
  const userPromptBase = userPromptTemplate
    ? `${userPromptTemplate}\n\nUser message:\n${message}`
    : message;
  const personaKbAugmentation = appendXchatKbMetadata({
    tools: xapiConfig.tools,
    linkedCollectionIds,
    resolvedCollectionsLine: teamKbMetaLine
  });
  const userPrompt = `${userPromptBase}\n\n${personaKbAugmentation}`;
  let xaiResponse: { outputText: string; model: string };
  let toolCallLogs: ToolCallLog[] = [];

  const wireTools = buildWireToolsForXaiResponses(xapiConfig.tools);
  logXchatAskPreRequestDebug({
    personaId: persona?._id?.toHexString(),
    personaName: persona?.name,
    model: effectiveModel,
    toolChoice: xapiConfig.toolChoice,
    maxTurns: xapiConfig.maxTurns,
    wireTools
  });

  try {
    const xaiTools = personaXapiToolsToXaiRequestTools(xapiConfig.tools);
    const executor = needsLocalToolLoop
      ? createXfinanceToolExecutor({
          userId: session.userId,
          tenantId: session.tenantId,
          workspacePreload: hasXfinanceTool ? workspacePreload : undefined
        })
      : async () => ({
          result: "",
          error: "local_tool_not_configured_for_persona"
        });

    const loopResult = await respondWithXaiToolLoop({
      model: effectiveModel,
      systemPrompt,
      userPrompt,
      tools: xaiTools,
      toolChoice: xapiConfig.toolChoice,
      maxTurns: xapiConfig.maxTurns,
      executor,
      parallelism: parallelAgentConfig,
      previousResponseId,
      storeMessages: useRemoteConversationHistory
    });
    xaiResponse = { outputText: loopResult.outputText, model: loopResult.model };
    toolCallLogs = loopResult.toolCalls;
    previousResponseId = loopResult.responseId;
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : "Unknown provider error";
    console.error("[xchat/ask] xAI provider call failed", {
      mode: "responses_tool_loop",
      personaId: persona?._id?.toHexString(),
      error: errMsg
    });
    logXchatAskProviderErrorDebug({
      personaId: persona?._id?.toHexString(),
      personaName: persona?.name,
      error: errMsg,
      wireTools: buildWireToolsForXaiResponses(xapiConfig.tools)
    });
    return NextResponse.json(
      {
        error: "xAI provider request failed",
        provider: "xai",
        retryable: true,
        details: summarizeProviderErrorForClient(errMsg)
      },
      { status: 502 }
    );
  }

  /** Same pipeline as the client `preprocessXchatMarkdown` — store and return display-ready markdown (citations, Grok leak cleanup). Idempotent if run twice. */
  const responseMarkdown = preprocessXchatMarkdown(xaiResponse.outputText);

  const contextChunkIds: ObjectId[] = [];

  logXchatAskDebug({
    userId: session.userId,
    email: session.email,
    personaId: persona?._id?.toHexString(),
    personaName: persona?.name,
    message,
    systemPrompt,
    userPrompt,
    ragContextLength: ragContext.length,
    contextSource,
    contextCount,
    tools: xapiConfig.tools.map((t) => t.type),
    model: effectiveModel,
    responseLength: responseMarkdown.length,
    mode: xapiConfig.mode,
    scope,
    collectionId: linkedCollectionIds[0],
    toolCallCount: toolCallLogs.length,
    modelSelectionSource
  });
  logXchatAskFullPayload({
    userId: session.userId,
    personaName: persona?.name,
    systemPrompt,
    userPrompt,
    ragContext,
    tools: xapiConfig.tools.map((t) => t.type),
    model: effectiveModel,
    responseText: xaiResponse.outputText
  });

  try {
    await createAuditEvent({
      entityType: "xchat_session",
      entityId: requestId,
      action: "xchat_turn_pending_xai_sync",
      actor: {
        userId: session.userId,
        email: session.email,
        username: session.username
      },
      details: {
        correlationId,
        userIdMasked: maskIdentifier(session.userId),
        tenantIdMasked: maskIdentifier(session.tenantId),
        personaId: persona?._id?.toHexString(),
        model: xaiResponse.model,
        scope,
        note: useRemoteConversationHistory
          ? "Turn stored in xchat_logs + xAI hosted conversation state (`store_messages`/`previous_response_id`)."
          : "Turn stored in xchat_logs; optional xAI user-collection sync is off unless XCHAT_SYNC_TURNS_TO_USER_XAI_COLLECTION=true."
      }
    });
  } catch (auditError) {
    console.error("[xchat/ask] failed to write xchat turn audit event", {
      requestId,
      correlationId,
      error: auditError instanceof Error ? auditError.message : String(auditError)
    });
  }

  const chatLogId = await saveXChatLog({
    requestId,
    correlationId,
    userId,
    tenantId: tenantId ?? undefined,
    userEmail: session.email,
    requestedBy: session.username,
    personaId: persona?._id,
    personaName: persona.name,
    scope,
    message,
    response: responseMarkdown,
    contextChunkIds,
    model: xaiResponse.model,
    xaiResponseId: previousResponseId,
    xapiMode: xapiConfig.mode,
    xapiToolChoice: xapiConfig.toolChoice,
    xapiMaxTurns: xapiConfig.maxTurns,
    xapiToolCount: xapiConfig.tools.length,
    collectionContextReferences,
    xapiToolCalls: toolCallLogs.length > 0
      ? toolCallLogs.map((tc) => ({
          name: tc.name,
          args: tc.args,
          resultHash: buildSha256Hex(tc.result),
          durationMs: tc.durationMs,
          error: tc.error
        }))
      : undefined,
  });

  fireAndForgetRecordXchatToolUsage({
    userId: session.userId,
    personaId: persona?._id?.toHexString(),
    personaName: persona?.name,
    requestId,
    toolCalls: toolCallLogs
  });

  return NextResponse.json(
    {
      data: {
        response: responseMarkdown,
        model: xaiResponse.model,
        personaName: persona.name,
        modelSelectionSource,
        contextCount,
        contextSource,
        collectionSearchStatus,
        collectionSearchNonReadyFileCount,
        logId: chatLogId.toHexString(),
        toolCalls: toolCallLogs.length > 0
          ? toolCallLogs.map((tc) => ({ name: tc.name, durationMs: tc.durationMs }))
          : undefined
      }
    },
    {
      headers: buildLimiterHeaders({
        remainingMinute: limiterRemainingMinute,
        remainingDay: limiterRemainingDay,
        dailyLimit: limiterDailyLimit
      })
    }
  );
  });
}

function createSnippetFingerprint(input: string): string {
  let hash = 2166136261;
  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index);
    hash +=
      (hash << 1) + (hash << 4) + (hash << 7) + (hash << 8) + (hash << 24);
  }
  return `f${(hash >>> 0).toString(16).padStart(8, "0")}`;
}

function buildSha256Hex(input: string): string {
  return createHash("sha256").update(input).digest("hex");
}

function buildDeterministicId(prefix: string, ...parts: Array<string | undefined>): string {
  const normalized = parts.map((part) => (part ?? "").trim()).join("|");
  const digest = buildSha256Hex(normalized);
  return `${prefix}_${digest.slice(0, 24)}`;
}

function maskIdentifier(value: string | undefined): string | undefined {
  const normalized = value?.trim();
  if (!normalized) {
    return undefined;
  }
  if (normalized.length <= 8) {
    return "***";
  }
  return `${normalized.slice(0, 4)}...${normalized.slice(-4)}`;
}

function canSessionUsePersona(input: {
  isAdminSession: boolean;
  hasAppRole: boolean;
  personaName: string;
  personaStatus: string | undefined;
  isAssignedPersona: boolean;
}): AskPersonaAccessResult {
  if (input.isAdminSession) {
    return { ok: true };
  }
  if (!input.hasAppRole) {
    return {
      ok: false,
      status: 403,
      error: "Persona is not available for current role",
      code: "persona_not_allowed_for_role"
    };
  }

  const status = input.personaStatus ?? "draft";
  if (status !== "published") {
    return {
      ok: false,
      status: 403,
      error: "Persona is not available for app users",
      code: "persona_not_allowed"
    };
  }

  if (APP_USER_BLOCKED_PERSONA_KEYS.has(normalizeNameKey(input.personaName)) && !input.isAssignedPersona) {
    return {
      ok: false,
      status: 403,
      error: "Persona is not available for app users",
      code: "persona_not_allowed"
    };
  }

  return { ok: true };
}

function normalizeNameKey(input: string): string {
  return input.trim().toLowerCase();
}

function resolveParallelAgentConfig(input: {
  model: string;
  reasoningEffort: RequestedReasoningEffort | undefined;
}):
  | { ok: true; config?: ParallelAgentConfig }
  | { ok: false; error: string; code: string } {
  if (!MULTI_AGENT_MODELS.has(input.model)) {
    if (input.reasoningEffort) {
      return {
        ok: false,
        error:
          "reasoningEffort is only supported with grok-4.20-multi-agent or grok-4.20-multi-agent-0309",
        code: "invalid_reasoning_effort"
      };
    }
    return { ok: true, config: undefined };
  }

  const effort: ParallelReasoningEffort =
    input.reasoningEffort === "xhigh"
      ? "high"
      : (input.reasoningEffort ?? "medium");
  return {
    ok: true,
    config: {
      agentCount: effort === "high" ? 16 : 4,
      reasoningEffort: effort
    }
  };
}

const MAX_PROVIDER_ERROR_DETAIL_CHARS = 2048;

function summarizeProviderErrorForClient(message: string): string {
  const t = message.trim();
  if (t.length <= MAX_PROVIDER_ERROR_DETAIL_CHARS) {
    return t;
  }
  return `${t.slice(0, MAX_PROVIDER_ERROR_DETAIL_CHARS)}…`;
}

function buildLimiterHeaders(input: {
  remainingMinute?: number;
  remainingDay?: number;
  dailyLimit?: number;
  retryAfterSeconds?: number;
}): HeadersInit {
  const headers: Record<string, string> = {};
  if (typeof input.remainingMinute === "number") {
    headers["x-xchat-limit-remaining-minute"] = String(Math.max(0, input.remainingMinute));
  }
  if (typeof input.remainingDay === "number") {
    headers["x-xchat-limit-remaining-day"] = String(Math.max(0, input.remainingDay));
  }
  if (typeof input.dailyLimit === "number") {
    headers["x-xchat-limit-daily"] = String(Math.max(0, input.dailyLimit));
  }
  if (typeof input.retryAfterSeconds === "number") {
    headers["retry-after"] = String(Math.max(1, Math.ceil(input.retryAfterSeconds)));
  }
  return headers;
}
