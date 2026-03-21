import { ObjectId } from "mongodb";
import { NextResponse } from "next/server";
import { createHash } from "node:crypto";
import { z } from "zod";

import { requireSessionUser } from "@/lib/auth";
import { checkRateLimit } from "@/lib/rate-limit";
import {
    chatWithXai,
    respondWithXai,
    respondWithXaiToolLoop,
    searchDocumentsInCollections,
    type ToolCallLog
} from "@/lib/xai";
import { logXchatAskDebug, logXchatAskFullPayload } from "@/lib/xchat-debug";
import { createAuditEvent } from "@/modules/audit/repository";
import {
    appendXchatTurnToUserCollection,
    resolveOrCreateUserBootstrapCollection
} from "@/modules/core-admin/access-request-bootstrap";
import { getUserAdminSettings } from "@/modules/core-admin/repository";
import { isGlobalAdmin } from "@/modules/identity/authorization";
import { getCoreUserById } from "@/modules/identity/repository";
import type { SubscriptionPlan } from "@/modules/identity/types";
import {
    ATXFINANCE_SESSION_TOOL_INSTRUCTIONS,
    XPERSONA_SUPER_AGENT_NAME,
    XPERSONA_XFINANCE_NAME
} from "@/modules/xchat/default-xpersonas";
import { clampMultiAgentParallelismForPlan } from "@/modules/xchat/plan-limits";
import { getScopeReadinessSummary } from "@/modules/xchat/rag-file-readiness";
import {
    getPersonaById,
    listPersonas,
    resolveDefaultXchatPersonaForSession,
    retrieveRagChunks,
    saveXChatLog
} from "@/modules/xchat/repository";
import {
    ATXFINANCE_TOOL_DEFINITION,
    createXfinanceToolExecutor,
    YAHOO_FINANCE_TOOL_DEFINITION
} from "@/modules/xchat/tool-executor";
import {
    ATXFINANCE_COLLECTION_ID,
    normalizePersonaXapiConfig,
    type PersonaXapiConfig,
    type PersonaXapiToolDefinition
} from "@/modules/xchat/types";
import { verifyXaiCollectionNonBlocking } from "@/modules/xchat/xai-collection-verifier";

const askSchema = z.object({
  message: z.string().min(2).max(8_000),
  personaId: z.string().optional(),
  reasoningEffort: z.enum(["low", "medium", "high"]).optional(),
  scope: z.string().min(1).max(128).optional(),
  topK: z.number().int().min(1).max(10).optional()
});

const MAX_ASK_PAYLOAD_BYTES = 24 * 1024;
const ASK_RATE_WINDOW_MS = 60_000;
const ASK_RATE_MAX = 20;
const DEFAULT_XCHAT_MODEL = "grok-4-1-fast-reasoning";
const MULTI_AGENT_MODEL = "grok-4.20-multi-agent";
const APP_USER_BLOCKED_PERSONA_KEYS = new Set<string>([
  normalizeNameKey(XPERSONA_SUPER_AGENT_NAME)
]);

type ModelSelectionSource = "default" | "persona";
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

  const contentLength = Number(request.headers.get("content-length") ?? "0");
  if (Number.isFinite(contentLength) && contentLength > MAX_ASK_PAYLOAD_BYTES) {
    return NextResponse.json({ error: "Payload too large" }, { status: 413 });
  }

  const rateLimit = checkRateLimit({
    key: `xchat-ask:${session.userId}`,
    windowMs: ASK_RATE_WINDOW_MS,
    max: ASK_RATE_MAX
  });
  if (!rateLimit.allowed) {
    return NextResponse.json(
      {
        error: "Rate limit exceeded",
        retryAfterSeconds: Math.ceil((rateLimit.resetAtMs - Date.now()) / 1000)
      },
      { status: 429 }
    );
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

  const { message, topK = 4 } = parsed.data;
  const isAdminSession = isGlobalAdmin(session.roles);

  const defaultPersona = await resolveDefaultXchatPersonaForSession(session.roles);
  if (!defaultPersona) {
    return NextResponse.json(
      {
        error:
          "Default admin xChat persona (Super-Agent) is missing. Run npm run seed:admin or create it in Admin → Personas."
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
  // If admin assigned a persona, it is authoritative for app_user sessions.
  const effectivePersonaId = assignedPersonaId || requestedPersonaId;
  const isAssignedPersonaOverride = Boolean(
    assignedPersonaId && effectivePersonaId && assignedPersonaId === effectivePersonaId
  );
  if (effectivePersonaId) {
    const requestedPersona = await getPersonaById(effectivePersonaId);
    if (!requestedPersona) {
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
      isAssignedPersona: isAssignedPersonaOverride
    });
    if (!access.ok) {
      return NextResponse.json(
        { error: access.error, code: access.code },
        { status: access.status }
      );
    }
    persona = requestedPersona;
  }

  const personaModelRaw =
    typeof persona?.model === "string" ? persona.model.trim().slice(0, 128) : "";
  const effectiveModel =
    personaModelRaw.length > 0 ? personaModelRaw : DEFAULT_XCHAT_MODEL;
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
    let subscriptionPlan: SubscriptionPlan | undefined;
    if (ObjectId.isValid(session.userId)) {
      const coreUser = await getCoreUserById(new ObjectId(session.userId));
      subscriptionPlan = coreUser?.subscriptionPlan;
    }
    parallelAgentConfig = clampMultiAgentParallelismForPlan(
      parallelAgentConfig,
      subscriptionPlan
    );
  }

  const baseXapiConfig: PersonaXapiConfig = normalizePersonaXapiConfig(persona?.xapi);
  const scope = parsed.data.scope ?? persona?.defaultScope ?? "global";
  const requestId = buildDeterministicId(
    "xreq",
    session.userId,
    session.tenantId ?? "tenant:none",
    effectivePersonaId ?? persona?._id?.toHexString() ?? persona?.name ?? "persona:none",
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
  const personaCollectionId = persona?.xaiCollection?.collectionId?.trim();
  const userCollection = await resolveOrCreateUserBootstrapCollection({
    userId: session.userId,
    tenantId: session.tenantId,
    email: session.email
  });
  const teamCollectionIds = isAdminSession ? await resolveAdminTeamCollectionIds() : [];
  const linkedCollectionIds = resolveLinkedCollectionIds({
    personaCollectionId,
    userCollectionId: userCollection?.collectionId,
    teamCollectionIds
  });
  for (const collectionId of linkedCollectionIds) {
    verifyXaiCollectionNonBlocking(collectionId);
  }
  const withFinanceTools = ensureInternalFinanceToolsForPersona(baseXapiConfig, persona?.name);
  const withAppMemberPortfolioTool =
    hasAppRole && !withFinanceTools.tools.some((tool) => tool.type === "atxfinance")
      ? {
          ...withFinanceTools,
          tools: [...withFinanceTools.tools, { type: "atxfinance" as const }]
        }
      : withFinanceTools;
  const xapiConfig = withLinkedCollectionTools(withAppMemberPortfolioTool, linkedCollectionIds);

  let contextSource: "none" | "mongo_scope" | "xai_collection" = "none";
  let ragChunks: Awaited<ReturnType<typeof retrieveRagChunks>> = [];
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
        tenantId: tenantId ?? undefined
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

    if (!ragContext) {
      try {
        ragChunks = await retrieveRagChunks(tenantId, scope, message, topK);
        if (ragChunks.length > 0) {
          contextSource = "mongo_scope";
        }
        contextCount = ragChunks.length;
        ragContext = ragChunks
          .map((chunk, index) => `[#${index + 1}] ${chunk.text}`)
          .join("\n\n");
      } catch (error) {
        console.error(
          `[xchat/ask] mongo scope retrieval failed for scope ${scope}:`,
          error instanceof Error ? error.message : error
        );
      }
    }
  }

  const hasXfinanceTool = xapiConfig.tools.some((t) => t.type === "atxfinance");
  const hasYahooFinanceTool = xapiConfig.tools.some((t) => t.type === "yahoo_finance");
  /** Custom tools must run through `respondWithXaiToolLoop`; `chatWithXai` does not execute tool_calls. */
  const needsLocalToolLoop = hasXfinanceTool || hasYahooFinanceTool;

  const systemPrompt = [
    persona?.systemPrompt ?? "You are xchat, an operations-focused assistant for atxfinance core admins.",
    ragContext ? `Use the following RAG context if relevant:\n${ragContext}` : "No RAG context available.",
    ...(hasXfinanceTool ? [ATXFINANCE_SESSION_TOOL_INSTRUCTIONS] : [])
  ].join("\n\n");
  const userPromptTemplate = persona?.overridePrompt?.trim() ?? "";
  const userPrompt = userPromptTemplate
    ? `${userPromptTemplate}\n\nUser message:\n${message}`
    : message;
  let xaiResponse: { outputText: string; model: string };
  let toolCallLogs: ToolCallLog[] = [];

  const chatCompletionsWithTools = () =>
    chatWithXai({
      model: effectiveModel,
      temperature: persona?.temperature ?? 0.2,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt }
      ],
      tools: xapiConfig.tools,
      toolChoice: xapiConfig.toolChoice,
      parallelism: parallelAgentConfig
    });

  const chatCompletionsNoTools = () =>
    chatWithXai({
      model: effectiveModel,
      temperature: persona?.temperature ?? 0.2,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt }
      ],
      toolChoice: "none",
      parallelism: parallelAgentConfig
    });

  const fallbackToChat = async (): Promise<{ outputText: string; model: string }> => {
    try {
      return await chatCompletionsWithTools();
    } catch {
      return chatCompletionsNoTools();
    }
  };

  try {
    if (xapiConfig.mode === "chat_completions" && !needsLocalToolLoop) {
      xaiResponse = await chatCompletionsWithTools();
    } else if (needsLocalToolLoop) {
      const xaiTools: Array<Record<string, unknown>> = xapiConfig.tools
        .filter((t) => t.type !== "atxfinance" && t.type !== "yahoo_finance")
        .map((t) => ({ ...t }));
      if (hasXfinanceTool) {
        xaiTools.push(ATXFINANCE_TOOL_DEFINITION);
      }
      if (hasYahooFinanceTool) {
        xaiTools.push(YAHOO_FINANCE_TOOL_DEFINITION);
      }

      const executor = createXfinanceToolExecutor({
        userId: session.userId,
        tenantId: session.tenantId
      });
      try {
        const loopResult = await respondWithXaiToolLoop({
          model: effectiveModel,
          systemPrompt,
          userPrompt,
          tools: xaiTools,
          toolChoice: xapiConfig.toolChoice,
          maxTurns: xapiConfig.maxTurns,
          executor,
          parallelism: parallelAgentConfig
        });
        xaiResponse = { outputText: loopResult.outputText, model: loopResult.model };
        toolCallLogs = loopResult.toolCalls;
      } catch (responsesErr) {
        console.warn("[xchat/ask] responses mode failed, falling back to chat_completions", {
          error: responsesErr instanceof Error ? responsesErr.message : String(responsesErr)
        });
        xaiResponse = await fallbackToChat();
      }
    } else {
      try {
        xaiResponse = await respondWithXai({
          model: effectiveModel,
          systemPrompt,
          userPrompt,
          tools: xapiConfig.tools,
          toolChoice: xapiConfig.toolChoice,
          maxTurns: xapiConfig.maxTurns,
          parallelism: parallelAgentConfig
        });
      } catch (responsesErr) {
        console.warn("[xchat/ask] responses mode failed, falling back to chat_completions", {
          error: responsesErr instanceof Error ? responsesErr.message : String(responsesErr)
        });
        xaiResponse = await fallbackToChat();
      }
    }
  } catch (error) {
    console.error("[xchat/ask] xAI provider call failed", {
      mode: xapiConfig.mode,
      personaId: persona?._id?.toHexString(),
      error: error instanceof Error ? error.message : "Unknown provider error"
    });
    return NextResponse.json(
      {
        error: "xAI provider request failed",
        provider: "xai",
        retryable: true
      },
      { status: 502 }
    );
  }

  const contextChunkIds = ragChunks.flatMap((chunk) => (chunk._id ? [chunk._id] : []));

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
    responseLength: xaiResponse.outputText.length,
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

  let xaiTurnFileId: string | undefined;
  let xaiTurnPayloadHash: string | undefined;
  let xaiTurnRetentionExpiresAt: Date | undefined;
  let turnSyncAuditAction: "xchat_turn_synced" | "xchat_turn_sync_failed" = "xchat_turn_synced";
  let turnSyncAuditError: string | undefined;
  try {
    const syncedTurn = await appendXchatTurnToUserCollection({
      userId: session.userId,
      tenantId: session.tenantId,
      email: session.email,
      collectionId: userCollection?.collectionId,
      personaName: persona.name,
      model: xaiResponse.model,
      scope,
      prompt: message,
      response: xaiResponse.outputText
    });
    xaiTurnFileId = syncedTurn.fileId;
    xaiTurnPayloadHash = syncedTurn.payloadHash;
    xaiTurnRetentionExpiresAt = syncedTurn.retentionExpiresAt;
  } catch (error) {
    turnSyncAuditAction = "xchat_turn_sync_failed";
    turnSyncAuditError = error instanceof Error ? error.message : String(error);
    console.warn("[xchat/ask] failed to sync prompt/response to user xAI collection", {
      userId: session.userId,
      error: turnSyncAuditError
    });
  }
  try {
    await createAuditEvent({
      entityType: "xchat_session",
      entityId: requestId,
      action: turnSyncAuditAction,
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
        xaiTurnFileIdMasked: maskIdentifier(xaiTurnFileId),
        xaiTurnPayloadHash: xaiTurnPayloadHash
          ? `${xaiTurnPayloadHash.slice(0, 12)}...${xaiTurnPayloadHash.slice(-6)}`
          : undefined,
        xaiTurnRetentionExpiresAt: xaiTurnRetentionExpiresAt?.toISOString(),
        error: turnSyncAuditError
      }
    });
  } catch (auditError) {
    console.error("[xchat/ask] failed to write xchat turn sync audit event", {
      requestId,
      correlationId,
      error: auditError instanceof Error ? auditError.message : String(auditError)
    });
  }

  await saveXChatLog({
    requestId,
    correlationId,
    userId,
    tenantId: tenantId ?? undefined,
    userEmail: session.email,
    requestedBy: session.username,
    personaId: persona?._id,
    message,
    response: xaiResponse.outputText,
    contextChunkIds,
    model: xaiResponse.model,
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
    xaiTurnFileId,
    xaiTurnPayloadHash,
    xaiTurnRetentionExpiresAt
  });

  return NextResponse.json({
    data: {
      response: xaiResponse.outputText,
      model: xaiResponse.model,
      personaName: persona.name,
      modelSelectionSource,
      contextCount,
      contextSource,
      collectionSearchStatus,
      collectionSearchNonReadyFileCount,
      toolCalls: toolCallLogs.length > 0
        ? toolCallLogs.map((tc) => ({ name: tc.name, durationMs: tc.durationMs }))
        : undefined
    }
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
  reasoningEffort: ParallelReasoningEffort | undefined;
}):
  | { ok: true; config?: ParallelAgentConfig }
  | { ok: false; error: string; code: string } {
  if (input.model !== MULTI_AGENT_MODEL) {
    if (input.reasoningEffort) {
      return {
        ok: false,
        error: "reasoningEffort is only supported with grok-4.20-multi-agent",
        code: "invalid_reasoning_effort"
      };
    }
    return { ok: true, config: undefined };
  }

  const effort = input.reasoningEffort ?? "medium";
  return {
    ok: true,
    config: {
      agentCount: effort === "high" ? 16 : 4,
      reasoningEffort: effort
    }
  };
}

function resolveLinkedCollectionIds(input: {
  personaCollectionId?: string;
  userCollectionId?: string;
  teamCollectionIds?: string[];
}): string[] {
  const ids = [
    input.personaCollectionId,
    ATXFINANCE_COLLECTION_ID,
    input.userCollectionId,
    ...(input.teamCollectionIds ?? [])
  ]
    .map((value) => value?.trim())
    .filter((value): value is string => Boolean(value));
  return Array.from(new Set(ids));
}

function withLinkedCollectionTools(
  config: PersonaXapiConfig,
  linkedCollectionIds: string[]
): PersonaXapiConfig {
  if (linkedCollectionIds.length === 0) {
    return config;
  }
  return {
    ...config,
    tools: config.tools.map((tool) => mergeCollectionIdsIntoTool(tool, linkedCollectionIds))
  };
}

function ensureInternalFinanceToolsForPersona(
  config: PersonaXapiConfig,
  personaName: string | undefined
): PersonaXapiConfig {
  const normalizedPersonaName = personaName?.trim().toLowerCase();
  const shouldInjectAtxfinance =
    normalizedPersonaName === XPERSONA_XFINANCE_NAME.toLowerCase() &&
    !config.tools.some((tool) => tool.type === "atxfinance");
  let tools = config.tools;
  if (shouldInjectAtxfinance) {
    tools = [...tools, { type: "atxfinance" }];
  }
  // Internal market-data rule: market quote path is always Yahoo-backed.
  if (!tools.some((tool) => tool.type === "yahoo_finance")) {
    tools = [...tools, { type: "yahoo_finance" }];
  }
  return {
    ...config,
    tools
  };
}

async function resolveAdminTeamCollectionIds(): Promise<string[]> {
  const personas = await listPersonas();
  const ids: string[] = [];
  for (const persona of personas) {
    const boundCollectionId = persona.xaiCollection?.collectionId?.trim();
    if (boundCollectionId) {
      ids.push(boundCollectionId);
    }
    const tools = normalizePersonaXapiConfig(persona.xapi).tools;
    for (const tool of tools) {
      if (tool.type === "collections_search" && Array.isArray(tool.collection_ids)) {
        for (const collectionId of tool.collection_ids) {
          if (typeof collectionId === "string" && collectionId.trim()) {
            ids.push(collectionId.trim());
          }
        }
      }
      if (tool.type === "file_search") {
        const source = (tool.source ?? {}) as Record<string, unknown>;
        if (Array.isArray(source.collection_ids)) {
          for (const collectionId of source.collection_ids) {
            if (typeof collectionId === "string" && collectionId.trim()) {
              ids.push(collectionId.trim());
            }
          }
        }
      }
    }
  }
  return Array.from(new Set(ids));
}

function mergeCollectionIdsIntoTool(
  tool: PersonaXapiToolDefinition,
  linkedCollectionIds: string[]
): PersonaXapiToolDefinition {
  if (tool.type === "file_search") {
    const source = (tool.source ?? {}) as Record<string, unknown>;
    const existingIds = Array.isArray(source.collection_ids)
      ? source.collection_ids
          .filter((id): id is string => typeof id === "string")
          .map((id) => id.trim())
          .filter((id) => id.length > 0)
      : [];
    return {
      ...tool,
      source: {
        ...source,
        collection_ids: Array.from(new Set([...existingIds, ...linkedCollectionIds]))
      }
    };
  }

  if (tool.type === "collections_search") {
    const existingIds = Array.isArray(tool.collection_ids)
      ? tool.collection_ids
          .filter((id): id is string => typeof id === "string")
          .map((id) => id.trim())
          .filter((id) => id.length > 0)
      : [];
    return {
      ...tool,
      collection_ids: Array.from(new Set([...existingIds, ...linkedCollectionIds]))
    };
  }

  return tool;
}