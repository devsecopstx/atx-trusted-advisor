import { ObjectId } from "mongodb";
import { NextResponse } from "next/server";
import { createHash, randomUUID } from "node:crypto";
import { z } from "zod";

import { preprocessXchatMarkdown } from "@/app/xchat/ui/xchat-markdown-preprocess";
import {
    isAppUserProductAccessAllowedState,
    resolveAppUserBillingAccessState
} from "@/lib/app-user-billing-state";
import { requireSessionUser } from "@/lib/auth";
import { getEnv, isXchatRemoteHistoryEnabled, readXaiVisionModelOverrideFromEnv } from "@/lib/env";
import { getInvestmentOutlookRefreshEnabled } from "@/lib/feature-flags";
import {
    getPersonaByIdCached,
    getTenantByHexIdCached,
    loadDefaultXchatPersonaForSessionDeduped
} from "@/lib/server-request-cache";
import { effectiveWorkspaceLimitsForTenantAndPlan } from "@/lib/tenant-workspace-limits";
import {
    respondWithXaiToolLoop,
    searchDocumentsInCollections,
    type XaiCollectionSearchSnippet,
    type XaiToolLoopResult
} from "@/lib/xai";
import { getDefaultPersonaChatModelId } from "@/lib/xai-default-persona-model";
import { summarizeToolLikeStreamEvent } from "@/lib/xai-responses-stream";
import { buildWireToolsForXaiResponses, personaXapiToolsToXaiRequestTools } from "@/lib/xai-tools";
import {
    logXchatAskPreRequestDebug,
    logXchatAskProviderErrorDebug,
    logXchatAskStreamDebug,
    logXchatAskToolBatchDebug,
    logXchatPerfDebug
} from "@/lib/xchat-debug";
import { runWithXchatTenantDebugAsync } from "@/lib/xchat-debug-context";
import {
    resolveXchatSseHeartbeatMs,
    wantsXchatLiveToolLoopSse
} from "@/lib/xchat-live-sse-policy";
import {
    getDefaultPortfolio,
    getUserAdminSettings
} from "@/modules/core-admin/repository";
import { canUserLogin, isGlobalAdmin } from "@/modules/identity/authorization";
import {
    getCoreUserById,
    getCoreUserOptionsScanPreferences,
    updateCoreUserOptionsScanPreferences
} from "@/modules/identity/repository";
import { isTenantXchatDebugPreferenceEnabled } from "@/modules/identity/tenant-branding-preferences";
import type { SubscriptionPlan } from "@/modules/identity/types";
import { lookupSymbols } from "@/modules/watchlist/yahoo-symbol-lookup";
import {
    formatAccountOutlookPromptInjection,
    resolveAccountOutlookContextForXchat
} from "@/modules/xchat/account-outlook-context";
import {
    enforceDistributedAskUsageLimit,
    type UsageLimitResult
} from "@/modules/xchat/ask-usage-limits";
import { appendXchatKbMetadata } from "@/modules/xchat/batch-prompt-context";
import { XPERSONA_GLOBAL_ADMIN_DEFAULT_NAME_KEYS } from "@/modules/xchat/default-xpersonas";
import {
    buildIncomeIdeasCompactPayload,
    buildIncomeIdeasJsonOnlySuffix,
    buildIncomeIdeasUserSuffix,
    collectIncomeIdeasEquitySymbols,
    filterRagSnippetsForIncomeIdeas,
    formatIncomeIdeasWorkspaceBlock,
    INCOME_IDEAS_RAG_QUERY,
    mergeIncomeIdeasRagContext,
    shouldOptimizeIncomeIdeasPrompt
} from "@/modules/xchat/income-ideas-prompt";
import {
    buildIncomeIdeasResponseCacheKey,
    setIncomeIdeasResponseCache,
    tryGetIncomeIdeasResponseCache
} from "@/modules/xchat/income-ideas-response-cache";
import { MULTI_AGENT_PERSONA_MODEL_IDS } from "@/modules/xchat/multi-agent-persona-models";
import { createOptionsScanReport } from "@/modules/xchat/options-action-report-repository";
import type { OptionsActionReportRow } from "@/modules/xchat/options-action-scan";
import { renderOptionsActionReportMarkdown } from "@/modules/xchat/options-action-scan";
import type { OptionsActionScanDisplayData } from "@/modules/xchat/options-action-scan-display";
import {
    MAX_XCHAT_TEAM_KB_COLLECTION_IDS,
    resolveXchatPersonaDeclaredCollectionIds,
    withLinkedCollectionTools
} from "@/modules/xchat/persona-linked-collections";
import { clampMultiAgentParallelismForPlan, clampToolLoopMaxTurnsForSession, clampTopK } from "@/modules/xchat/plan-limits";
import { getScopeReadinessSummary } from "@/modules/xchat/rag-file-readiness";
import {
    buildRagLexicalCacheKey,
    getRagLexicalCacheTtlSeconds,
    setRagLexicalCache,
    tryGetRagLexicalCache
} from "@/modules/xchat/rag-lexical-cache";
import {
    getLatestXchatLogByThread,
    saveXChatLog
} from "@/modules/xchat/repository";
import { createXfinanceToolExecutor } from "@/modules/xchat/tool-executor";
import {
    ensureSuperAgentDefaultTools,
    isAtxFunctionToolType,
    mergeXchatHostedToolBaseline,
    normalizePersonaXapiConfig,
    type PersonaXapiConfig
} from "@/modules/xchat/types";
import { getXchatUserPreferences } from "@/modules/xchat/user-preferences-repository";
import { postProcessWatchlistMarkdown } from "@/modules/xchat/watchlist-response-postprocess";
import {
    buildWorkspacePreloadHintForSystemPrompt,
    loadWorkspaceSnapshotPreload
} from "@/modules/xchat/workspace-snapshot-for-prompt";
import { verifyXaiCollectionNonBlocking } from "@/modules/xchat/xai-collection-verifier";
import {
    completeXchatAskAfterModelLoop,
    type XchatAskCompletePostLoopCtx
} from "@/modules/xchat/xchat-ask-complete-post-loop";
import {
    collectWatchlistPortfolioIdSlot,
    heavySynthesisIntent,
    isShowWatchlistIntent,
    shouldEagerWorkspaceSnapshotPreloadForMessage,
    shouldOfferStrategyJobPreflight,
    shouldRunOptionsActionScan,
    STRATEGY_JOB_PREFLIGHT_MARKDOWN
} from "@/modules/xchat/xchat-ask-routing";
import { createXchatLiveSseReadableStream } from "@/modules/xchat/xchat-ask-stream-sse";
import {
    MAX_XCHAT_ASK_JSON_BYTES,
    parseAndValidateXchatPasteImage
} from "@/modules/xchat/xchat-image-attachment";
import {
    computeLimitResetAtIso,
    limiterCircuitAllowDegraded,
    logXchatAskLimitDecision,
    recordXchatLimitCheckDurationMs,
    recordXchatLimitDecisionMetric,
    registerLimiterCheckFailure,
    resetLimiterFailureStreak,
    usageLimitDecisionFromResult,
    type XchatLimitDecision
} from "@/modules/xchat/xchat-limit-observability";
import { getXchatPlatformSettings } from "@/modules/xchat/xchat-platform-settings";
import {
    buildSessionToolInstructions,
    buildXchatSystemPrompt,
    classifyXchatSessionToolCopyMode,
    computeXchatRemoteChainInstructionsFingerprint,
    formatTenantWorkspaceContextBlockForXchat,
    XCHAT_SERVER_ROUTING_POLICY_BLOCK
} from "@/modules/xchat/xchat-prompt-build";
import {
    isXchatPromptLatencyMetricsEnabled,
    recordXchatPromptLatencySample
} from "@/modules/xchat/xchat-prompt-latency-metrics";
import {
    resolveReasoningEffortFromAskPayload,
    XCHAT_DEPTH_EXPERT_HEAVY_MODEL_ID,
    XCHAT_DEPTH_FAST_MODEL_ID
} from "@/modules/xchat/xchat-reasoning-mode";
import {
    resolveRecentThreadMessagesPromptBlock,
    type XchatRecentThreadMessage
} from "@/modules/xchat/xchat-recent-history-prompt";
import { resolveWorkspaceSnapshotQuoteNetwork } from "@/modules/xchat/xchat-workspace-quote-policy";

const xchatPasteImageAttachmentSchema = z.object({
  mediaType: z.enum(["image/png", "image/jpeg"]),
  dataBase64: z.string().min(8).max(6_000_000)
});

const askSchema = z
  .object({
    message: z.string().max(8_000),
    imageAttachment: xchatPasteImageAttachmentSchema.optional(),
    threadId: z.string().trim().min(1).max(128).optional(),
    strategyJobOptOut: z.boolean().optional(),
    recentMessages: z
      .array(
        z.object({
          role: z.enum(["user", "assistant"]),
          content: z.string().trim().min(1).max(8_000)
        })
      )
      .max(32)
      .optional(),
    portfolioId: z.string().trim().regex(/^[a-f\d]{24}$/i).optional(),
    personaId: z.string().optional(),
    reasoningEffort: z.enum(["none", "low", "medium", "high", "xhigh"]).optional(),
    reasoningMode: z.enum(["fast", "expert", "heavy"]).optional(),
    scope: z.string().min(1).max(128).optional(),
    topK: z.number().int().min(1).max(10).optional(),
    quoteFreshness: z.enum(["cached_first", "live"]).optional()
  })
  .superRefine((data, ctx) => {
    const t = data.message.trim();
    if (t.length < 2 && !data.imageAttachment) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Enter a message (2+ characters) or paste an image.",
        path: ["message"]
      });
    }
    if (data.reasoningMode !== undefined && data.reasoningEffort !== undefined) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Use reasoningMode or reasoningEffort, not both.",
        path: ["reasoningMode"]
      });
    }
  });
const ASK_RATE_MAX = 20;
const XCHAT_OPT_IN_RETENTION_DAYS = 60;
const STRATEGY_OPTOUT_SYSTEM_PROMPT_LINE =
  "User has explicitly chosen to stay in normal chat mode. Do NOT offer or mention strategy jobs, xStrategyBuilder, or the Spring orchestrator again in this conversation. Answer directly using tools, RAG, and portfolio context only. Keep full conversation history.";
const APP_USER_BLOCKED_PERSONA_KEYS = new Set<string>(
  XPERSONA_GLOBAL_ADMIN_DEFAULT_NAME_KEYS.map((k) => normalizeNameKey(k))
);

type ModelSelectionSource =
  | "default"
  | "persona"
  | "vision_env"
  | "reasoning_mode"
  | "reasoning_mode_fallback"
  | "reasoning_effort";
type RequestedReasoningEffort = "none" | "low" | "medium" | "high" | "xhigh";
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

function isStayInChatReply(message: string): boolean {
  const normalized = message.trim().toLowerCase();
  if (!normalized) {
    return false;
  }
  return (
    normalized === "stay in chat" ||
    normalized.includes("stay in chat") ||
    normalized === "stay here" ||
    normalized.includes("continue in chat")
  );
}

type XchatAskInteractionMeta = {
  generationMs: number;
  sources: {
    ragChunks: number;
    toolInvocations: number;
    personaCollections: number;
    total: number;
  };
};

function buildXchatAskInteractionMeta(
  startedAt: number,
  parts: {
    ragChunks: number;
    toolInvocations: number;
    personaCollections: number;
  }
): XchatAskInteractionMeta {
  const generationMs = Math.max(1, Date.now() - startedAt);
  return {
    generationMs,
    sources: {
      ragChunks: parts.ragChunks,
      toolInvocations: parts.toolInvocations,
      personaCollections: parts.personaCollections,
      total: parts.ragChunks + parts.toolInvocations + parts.personaCollections
    }
  };
}

/** Compact metadata for clients (mirrors `interactionMeta` + resolved persona + request `threadId`). */
type XchatAskResponseMetadataWire = {
  durationMs: number;
  sourcesUsed: number;
  personaId: string;
  model: string;
  threadId: string;
};

type XchatAskDataWithTiming = {
  response: string;
  model: string;
  interactionMeta: XchatAskInteractionMeta;
};

function buildXchatAskResponseMetadata(
  data: XchatAskDataWithTiming,
  ctx: { persona: { _id?: ObjectId } | null | undefined; threadId: string | undefined }
): XchatAskResponseMetadataWire {
  return {
    durationMs: data.interactionMeta.generationMs,
    sourcesUsed: data.interactionMeta.sources.total,
    personaId: ctx.persona?._id?.toHexString() ?? "",
    model: data.model,
    threadId: ctx.threadId ?? ""
  };
}

/** Canonical markdown alias (`content`) + metadata envelope alongside legacy `response` / `interactionMeta`. */
function withXchatAskContentAndMetadata<T extends XchatAskDataWithTiming>(
  data: T,
  ctx: { persona: { _id?: ObjectId } | null | undefined; threadId: string | undefined }
): T & { content: string; metadata: XchatAskResponseMetadataWire } {
  return {
    ...data,
    content: data.response,
    metadata: buildXchatAskResponseMetadata(data, ctx)
  };
}

export async function POST(request: Request) {
  const session = await requireSessionUser();
  if (session instanceof NextResponse) {
    return session;
  }
  const sessionCookie = request.headers.get("cookie") ?? undefined;

  const isAdminSession = isGlobalAdmin(session.roles);
  if (!isAdminSession && !canUserLogin(session.roles)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const coreUser =
    !isAdminSession && ObjectId.isValid(session.userId)
      ? await getCoreUserById(new ObjectId(session.userId))
      : null;
  const billingState = resolveAppUserBillingAccessState({
    roles: session.roles,
    billing: coreUser?.billing
  });
  if (!isAdminSession && !isAppUserProductAccessAllowedState(billingState)) {
    return NextResponse.json(
      {
        error: "Subscription required",
        code: "billing_subscription_required",
        state: billingState,
        redirectPath: "/account/billing"
      },
      { status: 402 }
    );
  }

  const tenantForDebug = ObjectId.isValid(session.tenantId)
    ? await getTenantByHexIdCached(session.tenantId)
    : null;
  const tenantDebugFlag = isTenantXchatDebugPreferenceEnabled(tenantForDebug);

  const tenantWorkspaceContextBlock = formatTenantWorkspaceContextBlockForXchat({
    tenantName: typeof tenantForDebug?.name === "string" ? tenantForDebug.name : "",
    xchatBrandName: tenantForDebug?.tenantPreferences?.xchat_brandname
  });

  return runWithXchatTenantDebugAsync(tenantDebugFlag, async () => {
  const askRequestStartedAt = Date.now();
  const markPerf = (
    stage: string,
    stageStartedAt: number,
    details?: Record<string, unknown>
  ): void => {
    logXchatPerfDebug({
      surface: "xchat_ask",
      stage,
      durationMs: Date.now() - stageStartedAt,
      details
    });
  };
  const contentLength = Number(request.headers.get("content-length") ?? "0");
  if (Number.isFinite(contentLength) && contentLength > MAX_XCHAT_ASK_JSON_BYTES) {
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

  const bodyJsonSize = JSON.stringify(body).length;
  if (bodyJsonSize > MAX_XCHAT_ASK_JSON_BYTES) {
    return NextResponse.json({ error: "Payload too large" }, { status: 413 });
  }

  const messageRaw = parsed.data.message;
  const messageTrimmed = messageRaw.trim();
  const visionParsed = parsed.data.imageAttachment
    ? parseAndValidateXchatPasteImage(parsed.data.imageAttachment)
    : null;
  if (visionParsed && !visionParsed.ok) {
    return NextResponse.json({ error: visionParsed.error }, { status: 400 });
  }
  const visionImage = visionParsed?.ok ? visionParsed.value : null;

  const recordAskLatencyIfEnabled = (mode: string): void => {
    if (!isXchatPromptLatencyMetricsEnabled()) {
      return;
    }
    const promptType = visionImage ? `vision_${mode}` : mode;
    void recordXchatPromptLatencySample({
      tenantId: session.tenantId.trim(),
      promptType,
      durationMs: Math.max(0, Date.now() - askRequestStartedAt)
    });
  };

  const xchatImageCaptionFallback =
    "Analyze this screenshot or pasted image. If it shows tickers, options, charts, or portfolio data, describe what you see and anything actionable. If it is not finance-related, say so briefly.";
  const captionForPrompt = messageTrimmed || (visionImage ? xchatImageCaptionFallback : "");
  const messageForPersistence = visionImage
    ? `[image:${visionImage.mediaType}] ${messageTrimmed || "(paste)"}`
    : messageRaw;
  const threadId = parsed.data.threadId?.trim() || randomUUID();
  const askCorrelationId =
    request.headers.get("x-correlation-id")?.trim() ||
    request.headers.get("x-request-id")?.trim() ||
    randomUUID();
  let workspacePortfolioId = parsed.data.portfolioId?.trim() || undefined;
  const showWatchlistIntent = isShowWatchlistIntent(messageTrimmed);
  const watchlistPortfolioSlot = collectWatchlistPortfolioIdSlot({
    message: messageTrimmed,
    requestPortfolioId: workspacePortfolioId
  });
  if (!workspacePortfolioId && watchlistPortfolioSlot.resolvedPortfolioId) {
    workspacePortfolioId = watchlistPortfolioSlot.resolvedPortfolioId;
  }
  let subscriptionPlan: SubscriptionPlan | undefined;
  if (!isAdminSession && ObjectId.isValid(session.userId)) {
    subscriptionPlan = coreUser?.subscriptionPlan;
  }
  const requestedTopK = parsed.data.topK ?? 4;
  const topK = isAdminSession ? requestedTopK : clampTopK(requestedTopK, subscriptionPlan);
  let dailyPromptCap: number | undefined;
  let hourlyPromptCap: number | undefined;
  if (!isAdminSession) {
    const xchatAskWorkspaceLimits = await effectiveWorkspaceLimitsForTenantAndPlan(
      tenantForDebug,
      subscriptionPlan
    );
    const rawDailyCap = xchatAskWorkspaceLimits.userChatLimit;
    dailyPromptCap =
      typeof rawDailyCap === "number" && Number.isFinite(rawDailyCap) && rawDailyCap > 0
        ? Math.floor(rawDailyCap)
        : undefined;
    const h = xchatAskWorkspaceLimits.userChatHourlyLimit;
    hourlyPromptCap = typeof h === "number" && h > 0 ? h : undefined;
  }
  const usageLimitStartedAt = Date.now();
  let usageCheck: UsageLimitResult;
  let limiterDegraded = false;
  try {
    usageCheck = await enforceDistributedAskUsageLimit({
      userId: session.userId,
      tenantId: session.tenantId,
      plan: subscriptionPlan,
      perMinuteLimit: ASK_RATE_MAX,
      enforceDailyLimit: !isAdminSession,
      dailyPromptLimit: dailyPromptCap,
      hourlyPromptLimit: hourlyPromptCap
    });
    resetLimiterFailureStreak();
  } catch (error) {
    const fails = registerLimiterCheckFailure();
    console.error("[xchat/ask] distributed usage limit check failed", {
      userId: session.userId,
      consecutiveFailures: fails,
      error: error instanceof Error ? error.message : String(error)
    });
    if (limiterCircuitAllowDegraded()) {
      limiterDegraded = true;
      console.warn("[xchat/ask] limiter circuit open — allowing ask (degraded)", {
        userId: session.userId,
        consecutiveFailures: fails
      });
      usageCheck = { allowed: true };
    } else {
      return NextResponse.json(
        {
          error: "xChat usage limiter is unavailable",
          retryable: true,
          correlationId: askCorrelationId
        },
        { status: 503 }
      );
    }
  }

  const usageLimitLatencyMs = Date.now() - usageLimitStartedAt;
  recordXchatLimitCheckDurationMs(usageLimitLatencyMs);

  const limitDecision: XchatLimitDecision = limiterDegraded
    ? "limiter_degraded_allow"
    : usageCheck.allowed
      ? "allowed"
      : usageLimitDecisionFromResult(false, usageCheck.code);

  recordXchatLimitDecisionMetric({
    decision: limitDecision,
    tenantId: session.tenantId,
    plan: subscriptionPlan
  });

  logXchatAskLimitDecision({
    type: "xchat.ask.limit_decision",
    correlationId: askCorrelationId,
    tenantId: session.tenantId,
    userId: session.userId,
    plan: subscriptionPlan,
    decision: limitDecision,
    latencyMs: usageLimitLatencyMs,
    effectiveDailyLimit: usageCheck.effectiveDailyLimit,
    effectiveHourlyLimit: usageCheck.effectiveHourlyLimit,
    currentMinuteCount: usageCheck.observedMinuteCount,
    currentHourCount: usageCheck.observedHourCount,
    currentDayCount: usageCheck.observedDayCount,
    limitCode: usageCheck.code,
    adminSession: isAdminSession,
    limiterDegraded
  });

  if (!usageCheck.allowed) {
    const retryAfter = usageCheck.retryAfterSeconds ?? 60;
    const limiterHeaders = buildLimiterHeaders({
      remainingMinute: usageCheck.remainingMinute,
      remainingHour: usageCheck.remainingHour,
      remainingDay: usageCheck.remainingDay,
      hourlyLimit: usageCheck.hourlyLimit,
      dailyLimit: usageCheck.dailyLimit,
      retryAfterSeconds: retryAfter
    });
    const resetAt = computeLimitResetAtIso(retryAfter);
    const limitError =
      usageCheck.code === "xchat_daily_limit_exceeded"
        ? "Daily prompt limit reached for your workspace (UTC calendar day). Your admin can raise caps under Tenant → Workspace limits, or compare plans."
        : usageCheck.code === "xchat_hourly_limit_exceeded"
          ? "Hourly prompt limit reached (UTC clock hour). Wait for the top of the next hour or ask your admin to adjust workspace limits."
          : "Too many messages sent in a short window. Pause briefly and try again.";
    return NextResponse.json(
      {
        error: limitError,
        code: usageCheck.code,
        retryAfterSeconds: retryAfter,
        resetAt,
        contactAdmin: true,
        correlationId: askCorrelationId,
        ...(usageCheck.code === "xchat_rate_limit_exceeded"
          ? { xchatLimitSource: "per_minute_burst" as const }
          : {}),
        ...(usageCheck.code === "xchat_daily_limit_exceeded" &&
        typeof usageCheck.dailyLimit === "number"
          ? {
              dailyLimit: usageCheck.dailyLimit,
              xchatLimitSource: "tenant_plan_effective" as const
            }
          : {}),
        ...(usageCheck.code === "xchat_hourly_limit_exceeded" &&
        typeof usageCheck.hourlyLimit === "number"
          ? {
              hourlyLimit: usageCheck.hourlyLimit,
              xchatLimitSource: "tenant_plan_effective" as const
            }
          : {})
      },
      { status: 429, headers: limiterHeaders }
    );
  }

  const limiterRemainingMinute = usageCheck.remainingMinute;
  const limiterRemainingHour = usageCheck.remainingHour;
  const limiterRemainingDay = usageCheck.remainingDay;
  const limiterHourlyLimit = usageCheck.hourlyLimit;
  const limiterDailyLimit = usageCheck.dailyLimit;
  markPerf("usage_limit_check", usageLimitStartedAt, {
    isAdminSession,
    limiterDegraded,
    hasDailyCap: typeof dailyPromptCap === "number",
    hasHourlyCap: typeof hourlyPromptCap === "number"
  });

  const personaResolveStartedAt = Date.now();
  const defaultPersona = await loadDefaultXchatPersonaForSessionDeduped(session.roles);
  if (!defaultPersona) {
    return NextResponse.json(
      {
        error:
          "Default xChat persona is unavailable. For admins, seed the advisor persona (`npm run seed:admin`). For app users, ensure the atx-trusted-advisor persona exists (Admin → Personas) or run `npm run seed:xpersonas`."
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
  const workspaceLimitsForPersona = await effectiveWorkspaceLimitsForTenantAndPlan(
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
  markPerf("persona_resolution", personaResolveStartedAt, {
    hasRequestedPersonaId: Boolean(requestedPersonaId),
    hasAssignedPersonaId: Boolean(assignedPersonaId),
    resolvedPersonaIdOverride: Boolean(resolvedPersonaIdOverride)
  });

  const askProcessingStartedAt = Date.now();
  const personaDeclaredCollectionCount = resolveXchatPersonaDeclaredCollectionIds(persona).length;

  const personaModelRaw =
    typeof persona?.model === "string" ? persona.model.trim().slice(0, 128) : "";
  const effectiveModel =
    personaModelRaw.length > 0 ? personaModelRaw : getDefaultPersonaChatModelId();
  let modelSelectionSource: ModelSelectionSource =
    personaModelRaw.length > 0 ? "persona" : "default";

  const reasoningMode = parsed.data.reasoningMode;
  const bodyReasoningEffort = parsed.data.reasoningEffort;
  if (
    bodyReasoningEffort === "none" &&
    MULTI_AGENT_PERSONA_MODEL_IDS.has(effectiveModel)
  ) {
    return NextResponse.json(
      {
        error:
          "reasoningEffort none is only valid when routing to grok-4.3 (non-multi-agent personas).",
        code: "invalid_reasoning_effort"
      },
      { status: 400 }
    );
  }
  const depthExpertHeavy = reasoningMode === "expert" || reasoningMode === "heavy";
  const depthFast =
    reasoningMode === "fast" ||
    (reasoningMode === undefined && bodyReasoningEffort === undefined);

  let executionModel = effectiveModel;
  let responsesReasoning:
    | { effort: "none" | "low" | "medium" | "high" }
    | undefined;

  let reasoningEffortForParallel: RequestedReasoningEffort | undefined;
  let multiAgentDowngraded = false;

  if (depthExpertHeavy) {
    executionModel = XCHAT_DEPTH_EXPERT_HEAVY_MODEL_ID;
    modelSelectionSource = "reasoning_mode";
    responsesReasoning = {
      effort: reasoningMode === "expert" ? "medium" : "high"
    };
  } else if (depthFast) {
    executionModel = XCHAT_DEPTH_FAST_MODEL_ID;
    modelSelectionSource = "reasoning_mode";
  } else {
    reasoningEffortForParallel = resolveReasoningEffortFromAskPayload({
      reasoningMode: undefined,
      reasoningEffort: bodyReasoningEffort
    });

    if (
      reasoningEffortForParallel &&
      !MULTI_AGENT_PERSONA_MODEL_IDS.has(effectiveModel)
    ) {
      executionModel = XCHAT_DEPTH_EXPERT_HEAVY_MODEL_ID;
      modelSelectionSource = "reasoning_effort";
      const eff: "none" | "low" | "medium" | "high" =
        reasoningEffortForParallel === "xhigh"
          ? "high"
          : reasoningEffortForParallel;
      responsesReasoning = { effort: eff };
      reasoningEffortForParallel = undefined;
    }

    if (
      responsesReasoning === undefined &&
      MULTI_AGENT_PERSONA_MODEL_IDS.has(executionModel)
    ) {
      const allowParallelism =
        reasoningEffortForParallel != null || heavySynthesisIntent(messageTrimmed);
      if (!allowParallelism) {
        executionModel = getDefaultPersonaChatModelId();
        multiAgentDowngraded = true;
        modelSelectionSource =
          personaModelRaw.length > 0 ? "persona" : "default";
      }
    }
  }

  const parallelAgentConfigResult = resolveParallelAgentConfig({
    model: executionModel,
    reasoningEffort: reasoningEffortForParallel
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

  if (visionImage) {
    parallelAgentConfig = undefined;
    const visionModelOverride = readXaiVisionModelOverrideFromEnv();
    if (visionModelOverride) {
      executionModel = visionModelOverride;
      modelSelectionSource = "vision_env";
      responsesReasoning = undefined;
    } else if (MULTI_AGENT_PERSONA_MODEL_IDS.has(executionModel)) {
      /** Multi-agent + `input_image` is unreliable on `/v1/responses`; fall back to the default chat model for this turn. */
      executionModel = getDefaultPersonaChatModelId();
      modelSelectionSource = "default";
      responsesReasoning = undefined;
    }
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
    messageRaw,
    visionImage?.contentFingerprint ?? "",
    executionModel,
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
  const [userPrefs, xchatPlatformSettings] = await Promise.all([
    userId
      ? getXchatUserPreferences({
          userId,
          tenantId
        })
      : Promise.resolve(null),
    getXchatPlatformSettings()
  ]);
  const shouldPersistHistory = userPrefs?.keepLastTenMessages === true;
  const retentionExpiresAt = shouldPersistHistory
    ? new Date(Date.now() + XCHAT_OPT_IN_RETENTION_DAYS * 24 * 60 * 60 * 1000)
    : undefined;

  let strategyJobOptOut = parsed.data.strategyJobOptOut === true;
  if (!strategyJobOptOut && threadId && userId && shouldPersistHistory) {
    const latestThreadLog = await getLatestXchatLogByThread({
      userId,
      tenantId,
      threadId
    });
    strategyJobOptOut = latestThreadLog?.strategyJobOptOut === true;
  }

  if (isStayInChatReply(messageTrimmed)) {
    strategyJobOptOut = true;
    const responseMarkdown = preprocessXchatMarkdown(
      "Understood, staying in chat. I will continue in normal chat mode for this conversation."
    );
    const stayMeta = buildXchatAskInteractionMeta(askProcessingStartedAt, {
      ragChunks: 0,
      toolInvocations: 0,
      personaCollections: personaDeclaredCollectionCount
    });
    const chatLogId = shouldPersistHistory
      ? await saveXChatLog({
          threadId,
          requestId,
          correlationId,
          userId,
          tenantId: tenantId ?? undefined,
          userEmail: session.email,
          requestedBy: session.username,
          personaId: persona?._id,
          personaName: persona.name,
          scope,
          message: messageForPersistence,
          response: responseMarkdown,
          contextChunkIds: [],
          model: "strategy_job_opt_out",
          strategyJobOptOut: true,
          retentionExpiresAt,
          interactionGenerationMs: stayMeta.generationMs
        })
      : null;
    return NextResponse.json(
      {
        data: withXchatAskContentAndMetadata(
          {
            response: responseMarkdown,
            strategyJobOffer: false,
            personaName: persona.name,
            modelSelectionSource,
            model: "strategy_job_opt_out",
            contextCount: 0,
            contextSource: "none",
            collectionSearchStatus: "skipped_no_collections",
            collectionSearchNonReadyFileCount: 0,
            logId: chatLogId?.toHexString(),
            interactionMeta: stayMeta
          },
          { persona, threadId }
        )
      },
      {
        headers: buildLimiterHeaders({
          remainingMinute: limiterRemainingMinute,
          remainingHour: limiterRemainingHour,
          remainingDay: limiterRemainingDay,
          hourlyLimit: limiterHourlyLimit,
          dailyLimit: limiterDailyLimit
        })
      }
    );
  }

  if (!strategyJobOptOut && !visionImage && shouldOfferStrategyJobPreflight(messageTrimmed)) {
    const responseMarkdown = preprocessXchatMarkdown(STRATEGY_JOB_PREFLIGHT_MARKDOWN);
    const preflightRequestId = buildDeterministicId(
      "xpref",
      session.userId,
      session.tenantId ?? "tenant:none",
      messageTrimmed.slice(0, 600)
    );
    const preflightCorrelationId = buildDeterministicId(
      "xcorr",
      preflightRequestId,
      session.userId,
      session.tenantId ?? "tenant:none"
    );
    const preflightMeta = buildXchatAskInteractionMeta(askProcessingStartedAt, {
      ragChunks: 0,
      toolInvocations: 0,
      personaCollections: personaDeclaredCollectionCount
    });
    const chatLogId = shouldPersistHistory
      ? await saveXChatLog({
          threadId,
          requestId: preflightRequestId,
          correlationId: preflightCorrelationId,
          userId,
          tenantId: tenantId ?? undefined,
          userEmail: session.email,
          requestedBy: session.username,
          personaId: persona?._id,
          personaName: persona.name,
          scope,
          message: messageForPersistence,
          response: responseMarkdown,
          contextChunkIds: [],
          model: "strategy_job_preflight",
          strategyJobOptOut,
          retentionExpiresAt,
          interactionGenerationMs: preflightMeta.generationMs
        })
      : null;
    return NextResponse.json(
      {
        data: withXchatAskContentAndMetadata(
          {
            response: responseMarkdown,
            strategyJobOffer: true,
            personaName: persona.name,
            modelSelectionSource,
            model: "strategy_job_preflight",
            contextCount: 0,
            contextSource: "none",
            collectionSearchStatus: "skipped_no_collections",
            collectionSearchNonReadyFileCount: 0,
            logId: chatLogId?.toHexString(),
            interactionMeta: preflightMeta
          },
          { persona, threadId }
        )
      },
      {
        headers: buildLimiterHeaders({
          remainingMinute: limiterRemainingMinute,
          remainingHour: limiterRemainingHour,
          remainingDay: limiterRemainingDay,
          hourlyLimit: limiterHourlyLimit,
          dailyLimit: limiterDailyLimit
        })
      }
    );
  }

  if (!visionImage && showWatchlistIntent && watchlistPortfolioSlot.needsPortfolioId) {
    const responseMarkdown = preprocessXchatMarkdown(
      "I can show that watchlist once I know which portfolio you mean. Please share the `portfolioId` (24-char id) or open the portfolio first and retry."
    );
    const slotMeta = buildXchatAskInteractionMeta(askProcessingStartedAt, {
      ragChunks: 0,
      toolInvocations: 0,
      personaCollections: personaDeclaredCollectionCount
    });
    const chatLogId = shouldPersistHistory
      ? await saveXChatLog({
          threadId,
          requestId,
          correlationId,
          userId,
          tenantId: tenantId ?? undefined,
          userEmail: session.email,
          requestedBy: session.username,
          personaId: persona?._id,
          personaName: persona.name,
          scope,
          message: messageForPersistence,
          response: responseMarkdown,
          contextChunkIds: [],
          model: "watchlist_portfolio_slot_collection",
          strategyJobOptOut,
          retentionExpiresAt,
          interactionGenerationMs: slotMeta.generationMs
        })
      : null;
    return NextResponse.json(
      {
        data: withXchatAskContentAndMetadata(
          {
            response: responseMarkdown,
            model: "watchlist_portfolio_slot_collection",
            personaName: persona.name,
            modelSelectionSource,
            contextCount: 0,
            contextSource: "none",
            collectionSearchStatus: "skipped_no_collections",
            collectionSearchNonReadyFileCount: 0,
            logId: chatLogId?.toHexString(),
            interactionMeta: slotMeta
          },
          { persona, threadId }
        )
      },
      {
        headers: buildLimiterHeaders({
          remainingMinute: limiterRemainingMinute,
          remainingHour: limiterRemainingHour,
          remainingDay: limiterRemainingDay,
          hourlyLimit: limiterHourlyLimit,
          dailyLimit: limiterDailyLimit
        })
      }
    );
  }

  /** RAG / collection tools: persona-declared ids only (no env team KB merge). */
  const linkedCollectionIds = resolveXchatPersonaDeclaredCollectionIds(persona);
  for (const collectionId of linkedCollectionIds) {
    verifyXaiCollectionNonBlocking(collectionId);
  }
  const xapiConfig = mergeXchatHostedToolBaseline(
    withLinkedCollectionTools(baseXapiConfig, linkedCollectionIds, "replace")
  );

  const effectiveMaxTurns = clampToolLoopMaxTurnsForSession({
    personaMaxTurns: xapiConfig.maxTurns,
    plan: subscriptionPlan,
    isAdminSession
  });

  const hasXfinanceTool = xapiConfig.tools.some((t) => isAtxFunctionToolType(t.type));
  const hasYahooFinanceTool = xapiConfig.tools.some((t) => t.type === "yahoo_finance");

  const workspaceSnapshotCtx = {
    userId: session.userId,
    tenantId: session.tenantId,
    workspacePortfolioId
  };
  const workspaceSnapshotQuoteNetwork = resolveWorkspaceSnapshotQuoteNetwork({
    message: messageTrimmed,
    reasoningMode,
    reasoningEffort: parsed.data.reasoningEffort,
    clientQuoteFreshness: parsed.data.quoteFreshness
  });
  const workspacePortfolioScoped =
    typeof workspacePortfolioId === "string" && workspacePortfolioId.trim().length > 0;
  const workspaceIncomeIdeasPreload =
    shouldEagerWorkspaceSnapshotPreloadForMessage(messageTrimmed);
  const incomeIdeasOptimizationCandidate =
    !visionImage &&
    shouldOptimizeIncomeIdeasPrompt(messageTrimmed) &&
    workspaceIncomeIdeasPreload;
  const likelyDirectWorkspaceToolPath =
    !visionImage &&
    (showWatchlistIntent ||
      shouldRunOptionsActionScan(messageTrimmed) ||
      workspacePortfolioScoped ||
      workspaceIncomeIdeasPreload);
  const shouldEagerWorkspacePreload = hasXfinanceTool && likelyDirectWorkspaceToolPath;
  const portfolioHexForOutlook =
    workspacePortfolioId?.trim() ||
    (await getDefaultPortfolio(session.userId, { tenantId: session.tenantId }))?._id?.toHexString() ||
    "";
  const ragAndPreloadStartedAt = Date.now();

  const [ragBundle, eagerWorkspacePreload, outlookCtx, limitsForOutlook] = await Promise.all([
    (async (): Promise<{
      contextSource: "none" | "xai_collection";
      collectionContextReferences: Array<{
        documentId?: string;
        documentName?: string;
        snippetFingerprint: string;
      }>;
      ragContext: string;
      contextCount: number;
      collectionSearchStatus: "ready" | "blocked_non_ready_files" | "skipped_no_collections";
      collectionSearchNonReadyFileCount: number;
    }> => {
      let contextSource: "none" | "xai_collection" = "none";
      let collectionContextReferences: Array<{
        documentId?: string;
        documentName?: string;
        snippetFingerprint: string;
      }> = [];
      let ragContext = "";
      let contextCount = 0;
      let collectionSearchStatus: "ready" | "blocked_non_ready_files" | "skipped_no_collections" =
        "ready";
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
            const ragTtl = getRagLexicalCacheTtlSeconds();
            const incomeIdeasRagMode = incomeIdeasOptimizationCandidate;
            const ragQuery = incomeIdeasRagMode
              ? INCOME_IDEAS_RAG_QUERY
              : messageTrimmed || "User attached an image for analysis.";
            const ragLimit = incomeIdeasRagMode ? Math.min(topK, 6) : topK;
            const ragKey =
              ragTtl > 0
                ? buildRagLexicalCacheKey({
                    collectionIds: linkedCollectionIds,
                    query: ragQuery,
                    limit: ragLimit
                  })
                : null;
            let collectionSnippets: XaiCollectionSearchSnippet[] = [];
            if (ragKey) {
              const hit = await tryGetRagLexicalCache(ragKey);
              if (hit && hit.length > 0) {
                collectionSnippets = hit;
              }
            }
            if (collectionSnippets.length === 0) {
              collectionSnippets = await searchDocumentsInCollections({
                query: ragQuery,
                collectionIds: linkedCollectionIds,
                limit: ragLimit
              });
              if (ragKey && ragTtl > 0 && collectionSnippets.length > 0) {
                void setRagLexicalCache(ragKey, collectionSnippets, ragTtl).catch(() => {
                  /* ignore */
                });
              }
            }
            const effectiveSnippets =
              incomeIdeasRagMode && collectionSnippets.length > 0
                ? filterRagSnippetsForIncomeIdeas(collectionSnippets)
                : collectionSnippets;

            if (incomeIdeasRagMode) {
              ragContext = mergeIncomeIdeasRagContext(effectiveSnippets);
              if (effectiveSnippets.length > 0) {
                contextSource = "xai_collection";
                contextCount = effectiveSnippets.length;
                collectionContextReferences = effectiveSnippets.map((snippet) => ({
                  documentId: snippet.documentId,
                  documentName: snippet.documentName,
                  snippetFingerprint: createSnippetFingerprint(snippet.text)
                }));
              }
            } else if (effectiveSnippets.length > 0) {
              contextSource = "xai_collection";
              contextCount = effectiveSnippets.length;
              collectionContextReferences = effectiveSnippets.map((snippet) => ({
                documentId: snippet.documentId,
                documentName: snippet.documentName,
                snippetFingerprint: createSnippetFingerprint(snippet.text)
              }));
              ragContext = effectiveSnippets
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

      return {
        contextSource,
        collectionContextReferences,
        ragContext,
        contextCount,
        collectionSearchStatus,
        collectionSearchNonReadyFileCount
      };
    })(),
    shouldEagerWorkspacePreload
      ? loadWorkspaceSnapshotPreload(workspaceSnapshotCtx, {
          snapshotQuoteNetwork: workspaceSnapshotQuoteNetwork
        })
      : Promise.resolve(null),
    portfolioHexForOutlook
      ? resolveAccountOutlookContextForXchat({
          userId: session.userId,
          tenantId: session.tenantId,
          portfolioIdHex: portfolioHexForOutlook
        })
      : Promise.resolve(null),
    effectiveWorkspaceLimitsForTenantAndPlan(tenantForDebug, subscriptionPlan)
  ]);
  const accountOutlookAugment = outlookCtx
    ? formatAccountOutlookPromptInjection(
        outlookCtx,
        getInvestmentOutlookRefreshEnabled({
          envEnabled: getEnv().INVESTMENT_OUTLOOK_REFRESH_ENABLED === true,
          tenantLimits: limitsForOutlook
        })
      )
    : "";
  markPerf("rag_and_workspace_prefetch", ragAndPreloadStartedAt, {
    hasXfinanceTool,
    shouldEagerWorkspacePreload,
    workspaceIncomeIdeasPreload,
    workspaceSnapshotQuoteNetwork,
    hasOutlookContext: Boolean(outlookCtx)
  });
  if (isXchatPromptLatencyMetricsEnabled()) {
    void recordXchatPromptLatencySample({
      tenantId: session.tenantId.trim(),
      promptType: "outlook-context-fetch-ms",
      durationMs: Math.max(0, Date.now() - ragAndPreloadStartedAt)
    });
    void recordXchatPromptLatencySample({
      tenantId: session.tenantId.trim(),
      promptType: "xchat-prompt-prep-time",
      durationMs: Math.max(0, Date.now() - ragAndPreloadStartedAt)
    });
  }

  const {
    contextSource,
    collectionContextReferences,
    ragContext: ragContextRaw,
    contextCount,
    collectionSearchStatus,
    collectionSearchNonReadyFileCount
  } = ragBundle;

  const incomeIdeasOptimization =
    incomeIdeasOptimizationCandidate && Boolean(eagerWorkspacePreload) && hasXfinanceTool;

  let ragContext = ragContextRaw;
  if (incomeIdeasOptimization && !ragContext.trim()) {
    ragContext = mergeIncomeIdeasRagContext([]);
  }

  let incomeIdeasQuoteMap:
    | Map<string, import("@/modules/watchlist/yahoo-symbol-lookup").SymbolLookupResult>
    | undefined;
  if (incomeIdeasOptimization && eagerWorkspacePreload) {
    const syms = collectIncomeIdeasEquitySymbols(eagerWorkspacePreload);
    if (syms.length > 0) {
      const fetched = await lookupSymbols(syms, {
        allowNetwork: workspaceSnapshotQuoteNetwork !== "cached_first"
      });
      incomeIdeasQuoteMap = fetched instanceof Map ? fetched : new Map();
    }
  }

  const incomeIdeasCacheKey =
    incomeIdeasOptimization && eagerWorkspacePreload && persona?._id && userId
      ? buildIncomeIdeasResponseCacheKey({
          tenantIdHex: tenantId?.toHexString() ?? "no_tenant",
          userIdHex: userId.toHexString(),
          preload: eagerWorkspacePreload,
          personaIdHex: persona._id.toHexString(),
          executionModel
        })
      : null;

  const atxWorkspaceExecutorOpts = !hasXfinanceTool
    ? {}
    : eagerWorkspacePreload
      ? { workspacePreload: eagerWorkspacePreload }
      : { workspaceLazyLoad: workspaceSnapshotCtx };

  if (!visionImage && hasXfinanceTool && shouldRunOptionsActionScan(messageTrimmed)) {
    const executor = createXfinanceToolExecutor({
      userId: session.userId,
      tenantId: session.tenantId,
      subscriptionPlan,
      platformRoles: session.roles,
      sessionCookie,
      workspacePortfolioId,
      ...atxWorkspaceExecutorOpts
    });
    const optionsScanStartedAt = Date.now();
    const optionsScanResult = await executor("atx_function", { operation: "options_action_scan" });
    const optionsScanDurationMs = Math.max(0, Date.now() - optionsScanStartedAt);
    let responseMarkdown = "I could not build your options action scan right now.";
    let optionsRows: OptionsActionReportRow[] = [];
    let optionsTruncated = false;
    let optionsGeneratedAt = new Date().toISOString();
    let optionsPlanTier: OptionsActionScanDisplayData["planTier"] = "basic";
    let optionsDisclaimer = "Not financial advice.";
    let optionsScanError = optionsScanResult.error;
    try {
      const parsed = JSON.parse(optionsScanResult.result) as {
        error?: string;
        rows?: OptionsActionReportRow[];
        truncated?: boolean;
        generatedAt?: string;
        planTier?: OptionsActionScanDisplayData["planTier"];
        disclaimer?: string;
      };
      if (typeof parsed.error === "string" && parsed.error.trim().length > 0) {
        optionsScanError = parsed.error;
      }
      optionsRows = Array.isArray(parsed.rows) ? parsed.rows : [];
      optionsTruncated = parsed.truncated === true;
      optionsGeneratedAt =
        typeof parsed.generatedAt === "string" && parsed.generatedAt.trim().length > 0
          ? parsed.generatedAt
          : optionsGeneratedAt;
      optionsPlanTier = parsed.planTier ?? optionsPlanTier;
      optionsDisclaimer =
        typeof parsed.disclaimer === "string" && parsed.disclaimer.trim().length > 0
          ? parsed.disclaimer
          : optionsDisclaimer;
      if (optionsRows.length > 0) {
        const isBasicTier = optionsPlanTier === "basic";
        responseMarkdown = renderOptionsActionReportMarkdown({
          rows: optionsRows,
          isBasicTier,
          generatedAtIso: optionsGeneratedAt
        });
      } else if (optionsScanError) {
        responseMarkdown = `I could not build your options action scan right now. (${optionsScanError})`;
      }
    } catch {
      optionsScanError = optionsScanError ?? "options_action_scan_parse_failed";
      responseMarkdown = `I could not build your options action scan right now. (${optionsScanError})`;
    }

    const output = preprocessXchatMarkdown(responseMarkdown);
    const optionsActionScan: OptionsActionScanDisplayData = {
      generatedAt: optionsGeneratedAt,
      planTier: optionsPlanTier,
      truncated: optionsTruncated,
      rows: optionsRows,
      disclaimer: optionsDisclaimer
    };
    let optionsScanReportId: string | undefined;
    if (userId) {
      const prefs = await getCoreUserOptionsScanPreferences(userId);
      const reportId = await createOptionsScanReport({
        userId,
        tenantId: tenantId ?? undefined,
        source: "on_demand",
        frequency: prefs.frequency,
        deliveryChannel: prefs.deliveryChannel,
        rows: optionsRows,
        truncated: optionsTruncated,
        reportMarkdown: output
      });
      optionsScanReportId = reportId.toHexString();
      await updateCoreUserOptionsScanPreferences(userId, { lastRunAt: new Date() });
    }

    const optionsMeta = buildXchatAskInteractionMeta(askProcessingStartedAt, {
      ragChunks: contextCount,
      toolInvocations: 1,
      personaCollections: linkedCollectionIds.length
    });

    const chatLogId = shouldPersistHistory
      ? await saveXChatLog({
          threadId,
          requestId,
          correlationId,
          userId,
          tenantId: tenantId ?? undefined,
          userEmail: session.email,
          requestedBy: session.username,
          personaId: persona?._id,
          personaName: persona.name,
          scope,
          message: messageForPersistence,
          response: output,
          contextChunkIds: [],
          model: "options_action_scan_direct",
          strategyJobOptOut,
          retentionExpiresAt,
          interactionGenerationMs: optionsMeta.generationMs,
          xapiToolCalls: [
            {
              name: "atx_function",
              args: { operation: "options_action_scan" },
              resultHash: buildSha256Hex(optionsScanResult.result),
              durationMs: optionsScanDurationMs,
              ...(optionsScanError ? { error: optionsScanError } : {})
            }
          ]
        })
      : null;

    return NextResponse.json(
      {
        data: withXchatAskContentAndMetadata(
          {
            response: output,
            model: "options_action_scan_direct",
            personaName: persona.name,
            modelSelectionSource,
            contextCount: 0,
            contextSource: "none",
            collectionSearchStatus: "skipped_no_collections",
            collectionSearchNonReadyFileCount: 0,
            logId: chatLogId?.toHexString(),
            optionsActionScan,
            optionsScanReportId,
            toolCalls: [{ name: "atx_function", durationMs: optionsScanDurationMs }],
            interactionMeta: optionsMeta
          },
          { persona, threadId }
        )
      },
      {
        headers: buildLimiterHeaders({
          remainingMinute: limiterRemainingMinute,
          remainingHour: limiterRemainingHour,
          remainingDay: limiterRemainingDay,
          hourlyLimit: limiterHourlyLimit,
          dailyLimit: limiterDailyLimit
        })
      }
    );
  }

  if (!visionImage && hasXfinanceTool && showWatchlistIntent) {
    const executor = createXfinanceToolExecutor({
      userId: session.userId,
      tenantId: session.tenantId,
      subscriptionPlan,
      platformRoles: session.roles,
      sessionCookie,
      workspacePortfolioId,
      ...atxWorkspaceExecutorOpts
    });
    const watchlistCallStartedAt = Date.now();
    const watchlistToolResult = await executor("atx_function", { operation: "watchlist_snapshot" });
    const watchlistCallDurationMs = Math.max(0, Date.now() - watchlistCallStartedAt);
    let responseMarkdown = "I could not load your watchlist right now.";
    let watchlistError = watchlistToolResult.error;

    try {
      const parsed = JSON.parse(watchlistToolResult.result) as {
        error?: string;
        name?: string;
        symbolCount?: number;
        symbols?: Array<{
          symbol?: string;
          addedAt?: string;
          lineType?: string;
          strategy?: string;
          targetEntryPrice?: number;
          entryPrice?: number;
          spotPriceDisplay?: string;
          /** 100× live quote notional — same as Watchlist page "Target entry" column. */
          targetEntryNotional100xDisplay?: string;
          /** Same basis as notional column, USD currency string. */
          targetEntryNotional100xUsdDisplay?: string;
        }>;
      };
      if (parsed.error === "no_watchlist") {
        responseMarkdown =
          "No default watchlist is available yet. Open Watchlist in the app to create or import symbols.";
      } else {
        const rows = Array.isArray(parsed.symbols) ? parsed.symbols : [];
        const cleanRows = rows.filter((row) => typeof row.symbol === "string" && row.symbol.trim().length > 0);
        if (cleanRows.length === 0) {
          responseMarkdown = `${parsed.name ?? "Your watchlist"} has no symbols yet.`;
        } else {
          const header = `Your ${parsed.name ?? "watchlist"} has ${cleanRows.length} symbol${
            cleanRows.length === 1 ? "" : "s"
          }:`;
          const lines = cleanRows.map((row) => {
            const symbol = row.symbol!.trim().toUpperCase();
            const spot =
              typeof row.spotPriceDisplay === "string" && row.spotPriceDisplay.trim().length > 0
                ? row.spotPriceDisplay.trim()
                : "—";
            const targetUsd =
              typeof row.targetEntryNotional100xUsdDisplay === "string" &&
              row.targetEntryNotional100xUsdDisplay !== "—"
                ? row.targetEntryNotional100xUsdDisplay
                : "—";
            return `- ${symbol} — Spot: ${spot} · Target entry: ${targetUsd}`;
          });
          const legacyMarkdown = `${header}\n${lines.join("\n")}`;
          responseMarkdown = await postProcessWatchlistMarkdown({
            rawMarkdown: legacyMarkdown,
            watchlistName: parsed.name,
            structuredRows: cleanRows.map((row) => ({
              symbol: row.symbol!.trim().toUpperCase(),
              spotPriceDisplay:
                typeof row.spotPriceDisplay === "string" ? row.spotPriceDisplay : undefined,
              entryPrice: typeof row.entryPrice === "number" ? row.entryPrice : undefined,
              targetEntryPrice:
                typeof row.targetEntryPrice === "number" ? row.targetEntryPrice : undefined,
              targetEntryNotional100xUsdDisplay:
                typeof row.targetEntryNotional100xUsdDisplay === "string"
                  ? row.targetEntryNotional100xUsdDisplay
                  : undefined
            })),
            portfolioId: workspacePortfolioId
          });
        }
      }
    } catch {
      watchlistError = watchlistError ?? "watchlist_parse_failed";
    }

    const output = preprocessXchatMarkdown(responseMarkdown);
    const wlMeta = buildXchatAskInteractionMeta(askProcessingStartedAt, {
      ragChunks: contextCount,
      toolInvocations: 1,
      personaCollections: linkedCollectionIds.length
    });
    const chatLogId = shouldPersistHistory
      ? await saveXChatLog({
          threadId,
          requestId,
          correlationId,
          userId,
          tenantId: tenantId ?? undefined,
          userEmail: session.email,
          requestedBy: session.username,
          personaId: persona?._id,
          personaName: persona.name,
          scope,
          message: messageForPersistence,
          response: output,
          contextChunkIds: [],
          model: "watchlist_snapshot_direct",
          strategyJobOptOut,
          retentionExpiresAt,
          interactionGenerationMs: wlMeta.generationMs,
          xapiToolCalls: [
            {
              name: "atx_function",
              args: { operation: "watchlist_snapshot" },
              resultHash: buildSha256Hex(watchlistToolResult.result),
              durationMs: watchlistCallDurationMs,
              ...(watchlistError ? { error: watchlistError } : {})
            }
          ]
        })
      : null;

    return NextResponse.json(
      {
        data: withXchatAskContentAndMetadata(
          {
            response: output,
            model: "watchlist_snapshot_direct",
            personaName: persona.name,
            modelSelectionSource,
            contextCount: 0,
            contextSource: "none",
            collectionSearchStatus: "skipped_no_collections",
            collectionSearchNonReadyFileCount: 0,
            logId: chatLogId?.toHexString(),
            toolCalls: [{ name: "atx_function", durationMs: watchlistCallDurationMs }],
            interactionMeta: wlMeta
          },
          { persona, threadId }
        )
      },
      {
        headers: buildLimiterHeaders({
          remainingMinute: limiterRemainingMinute,
          remainingHour: limiterRemainingHour,
          remainingDay: limiterRemainingDay,
          hourlyLimit: limiterHourlyLimit,
          dailyLimit: limiterDailyLimit
        })
      }
    );
  }
  /** Custom tools must run through `respondWithXaiToolLoop`; `chatWithXai` does not execute tool_calls. */
  const needsLocalToolLoop = hasXfinanceTool || hasYahooFinanceTool;
  /**
   * Keep one execution workflow to avoid live-search drift: all asks use the multi-turn Responses
   * tool loop, regardless of persona xapi.mode, so hosted and local tools share identical handling.
   */
  const hasHostedSearchTool = xapiConfig.tools.some((t) => t.type === "web_search" || t.type === "x_search");

  const useRemoteConversationHistory =
    isXchatRemoteHistoryEnabled() &&
    shouldPersistHistory &&
    persona?.keepXchatHistory !== false &&
    Boolean(userId) &&
    !visionImage;

  const tenantWorkspaceCtxBase =
    typeof tenantWorkspaceContextBlock === "string" ? tenantWorkspaceContextBlock.trim() : "";
  const effectiveTenantWorkspaceContextBlock = [tenantWorkspaceCtxBase, accountOutlookAugment]
    .filter((s) => s.trim().length > 0)
    .join("\n\n");

  const remoteChainInstructionsFingerprint = computeXchatRemoteChainInstructionsFingerprint({
    personaSystem: persona?.systemPrompt ?? "",
    personaUpdatedAtMs: persona?.updatedAt?.getTime() ?? 0,
    strategyJobOptOut,
    hostedSearch: hasHostedSearchTool,
    atxFunction: hasXfinanceTool,
    citationsEnabled: persona?.citationsEnabled !== false,
    tenantWorkspaceContextBlock:
      effectiveTenantWorkspaceContextBlock.trim().length > 0
        ? effectiveTenantWorkspaceContextBlock
        : tenantWorkspaceCtxBase
  });

  let previousResponseId: string | undefined;
  if (useRemoteConversationHistory && threadId && userId && persona?._id) {
    const latest = await getLatestXchatLogByThread({
      userId,
      tenantId,
      threadId,
      personaId: persona._id
    });
    const rid = latest?.xaiResponseId?.trim();
    if (rid && rid.length > 0) {
      const storedFp = latest?.xchatInstructionsFingerprint?.trim();
      if (!storedFp || storedFp === remoteChainInstructionsFingerprint) {
        previousResponseId = rid;
      }
    }
  }

  const teamKbMetaLine =
    linkedCollectionIds.length > 0
      ? `xChat linked xAI collection ids (persona-declared; max ${MAX_XCHAT_TEAM_KB_COLLECTION_IDS}): ${linkedCollectionIds.join(", ")}`
      : "xChat linked xAI collection ids: (none — link collections on the persona or declare file_search/collections_search collection_ids)";

  const recentThreadMessages: XchatRecentThreadMessage[] = (
    parsed.data.recentMessages ?? []
  )
    .map((row) => ({
      role: row.role,
      content: row.content.trim()
    }))
    .filter((row) => row.content.length > 0)
    .slice(-32);
  const recentHistoryBlock =
    useRemoteConversationHistory && previousResponseId
      ? ""
      : resolveRecentThreadMessagesPromptBlock({
          messages: recentThreadMessages,
          executionModel,
          grok43MaxPriorThreadMessages: xchatPlatformSettings?.xchatGrok43MaxPriorThreadMessages
        }) ?? "";

  const sessionToolCopyMode =
    useRemoteConversationHistory && previousResponseId
      ? ("full" as const)
      : classifyXchatSessionToolCopyMode(messageTrimmed);

  const workspaceSnapshotForPrompt =
    shouldEagerWorkspacePreload && eagerWorkspacePreload
      ? incomeIdeasOptimization
        ? formatIncomeIdeasWorkspaceBlock(
            buildIncomeIdeasCompactPayload(eagerWorkspacePreload, incomeIdeasQuoteMap)
          )
        : buildWorkspacePreloadHintForSystemPrompt(eagerWorkspacePreload)
      : null;

  const builtSystemPrompt = buildXchatSystemPrompt({
    tenantWorkspaceContextBlock:
      effectiveTenantWorkspaceContextBlock.trim().length > 0
        ? effectiveTenantWorkspaceContextBlock
        : tenantWorkspaceContextBlock,
    personaSystem: persona?.systemPrompt ?? "",
    fallbackPersonaSystem: "You are xchat, an operations-focused assistant for atxfinance core admins.",
    ragContext,
    recentHistoryBlock,
    workspaceSnapshot: workspaceSnapshotForPrompt,
    sessionToolInstructions: buildSessionToolInstructions(
      {
        hostedSearch: hasHostedSearchTool,
        atxFunction: hasXfinanceTool
      },
      sessionToolCopyMode
    ),
    routingPolicyBlock: XCHAT_SERVER_ROUTING_POLICY_BLOCK,
    citationsEnabled: persona?.citationsEnabled !== false
  });
  let systemPrompt = strategyJobOptOut
    ? `${STRATEGY_OPTOUT_SYSTEM_PROMPT_LINE}\n\n${builtSystemPrompt}`
    : builtSystemPrompt;
  if (incomeIdeasOptimization) {
    systemPrompt = `${systemPrompt}\n\n${buildIncomeIdeasJsonOnlySuffix()}`;
  }
  const userPromptTemplate = persona?.overridePrompt?.trim() ?? "";
  const userPromptBase = userPromptTemplate
    ? `${userPromptTemplate}\n\nUser message:\n${captionForPrompt}`
    : captionForPrompt;
  const personaKbAugmentation = appendXchatKbMetadata({
    tools: xapiConfig.tools,
    linkedCollectionIds,
    resolvedCollectionsLine: teamKbMetaLine
  });
  let userPrompt = `${userPromptBase}\n\n${personaKbAugmentation}`;
  if (incomeIdeasOptimization) {
    userPrompt = `${userPrompt}\n\n${buildIncomeIdeasUserSuffix()}`;
  }

  if (!userId) {
    return NextResponse.json(
      { error: "Missing user id for xChat turn", code: "user_id_required" },
      { status: 400 }
    );
  }

  const wireTools = buildWireToolsForXaiResponses(xapiConfig.tools);
  logXchatAskPreRequestDebug({
    personaId: persona?._id?.toHexString(),
    personaName: persona?.name,
    model: executionModel,
    toolChoice: xapiConfig.toolChoice,
    maxTurns: effectiveMaxTurns,
    wireTools
  });

  const xaiTools = personaXapiToolsToXaiRequestTools(xapiConfig.tools);
  const executor = needsLocalToolLoop
    ? createXfinanceToolExecutor({
        userId: session.userId,
        tenantId: session.tenantId,
        subscriptionPlan,
        platformRoles: session.roles,
        sessionCookie,
        workspacePortfolioId,
        ...(hasXfinanceTool ? atxWorkspaceExecutorOpts : {})
      })
    : async () => ({
        result: "",
        error: "local_tool_not_configured_for_persona"
      });

  const askCompleteCtx = (): XchatAskCompletePostLoopCtx => ({
    session,
    persona: { _id: persona._id, name: persona.name },
    threadId,
    messageForPersistence,
    systemPrompt,
    userPrompt,
    ragContext,
    contextSource,
    contextCount,
    xapiConfig,
    executionModel,
    scope,
    linkedCollectionIds,
    collectionSearchStatus,
    collectionSearchNonReadyFileCount,
    correlationId,
    requestId,
    userId,
    tenantId,
    shouldPersistHistory,
    retentionExpiresAt,
    strategyJobOptOut,
    remoteChainInstructionsFingerprint,
    collectionContextReferences,
    askProcessingStartedAt,
    modelSelectionSource,
    multiAgentDowngraded,
    effectiveModel,
    remoteHistoryContinuation: Boolean(useRemoteConversationHistory && previousResponseId),
    limiterRemainingMinute,
    limiterRemainingHour,
    limiterRemainingDay,
    limiterHourlyLimit,
    limiterDailyLimit
  });

  /** Scope cache by persona so switching persona mid-thread never reuses prior instructions bytes. */
  const personaCacheSegment = persona?._id?.toHexString() ?? "persona";
  const promptCacheKey =
    threadId?.trim() && !previousResponseId
      ? `xf-xchat:${threadId.trim().slice(0, 160)}:${personaCacheSegment}`.slice(0, 256)
      : undefined;

  const toolLoopShared = {
    model: executionModel,
    systemPrompt,
    userPrompt,
    userImageDataUrl: visionImage?.dataUrl,
    tools: xaiTools,
    toolChoice: xapiConfig.toolChoice,
    maxTurns: effectiveMaxTurns,
    executor,
    parallelism: parallelAgentConfig,
    responsesReasoning,
    previousResponseId,
    storeMessages: useRemoteConversationHistory,
    promptCacheKey,
    signal: request.signal
  };

  const handleToolLoopFailure = (error: unknown): NextResponse => {
    markPerf("ask_request_total", askRequestStartedAt, {
      mode: "failed",
      aborted: request.signal.aborted
    });
    const aborted =
      request.signal.aborted ||
      (error instanceof DOMException && error.name === "AbortError") ||
      (error instanceof Error && error.name === "AbortError");
    if (aborted) {
      console.warn("[xchat/ask] request aborted", {
        mode: "responses_tool_loop",
        personaId: persona?._id?.toHexString()
      });
      return NextResponse.json(
        { error: "Request cancelled", code: "request_aborted" },
        { status: 499 }
      );
    }
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
  };

  const liveToolLoopSse = wantsXchatLiveToolLoopSse(request);

  if (incomeIdeasCacheKey && incomeIdeasOptimization) {
    const cachedIncomeIdeas = await tryGetIncomeIdeasResponseCache(incomeIdeasCacheKey);
    if (cachedIncomeIdeas) {
      const cachedLoopResult: XaiToolLoopResult = {
        model: executionModel,
        outputText: cachedIncomeIdeas,
        toolCalls: [],
        turnsUsed: 0,
        raw: { incomeIdeasResponseCacheHit: true }
      };
      if (!liveToolLoopSse) {
        markPerf("ask_request_total", askRequestStartedAt, {
          mode: "json_income_ideas_cache",
          turnsUsed: 0
        });
        recordAskLatencyIfEnabled("json_income_ideas_cache");
        return completeXchatAskAfterModelLoop(cachedLoopResult, askCompleteCtx());
      }
      const heartbeatMsCached = resolveXchatSseHeartbeatMs();
      const limiterHeadCached = buildLimiterHeaders({
        remainingMinute: limiterRemainingMinute,
        remainingHour: limiterRemainingHour,
        remainingDay: limiterRemainingDay,
        hourlyLimit: limiterHourlyLimit,
        dailyLimit: limiterDailyLimit
      });
      const cacheStreamStartedRef = { at: Date.now() };
      const cacheStream = createXchatLiveSseReadableStream({
        heartbeatMs: heartbeatMsCached,
        run: async (emit) => {
          emit.meta({
            v: 1,
            phase: "live_tool_loop",
            threadId: threadId ?? "",
            model: executionModel,
            personaId: persona._id?.toHexString() ?? ""
          });
          logXchatAskStreamDebug({
            sseEvent: "meta",
            requestId,
            correlationId,
            phase: "income_ideas_cache"
          });
          for (const piece of chunkIncomeIdeasCacheForSse(cachedIncomeIdeas, 140)) {
            emit.delta({ c: piece });
          }
          const finalizeRes = await completeXchatAskAfterModelLoop(cachedLoopResult, askCompleteCtx());
          const finalizeJson = (await finalizeRes.json()) as { data?: Record<string, unknown> };
          const data = finalizeJson.data;
          if (!data || typeof data !== "object") {
            emit.error({ message: "finalize_failed", code: "internal_error" });
            return;
          }
          emit.done(data as Record<string, unknown>);
          markPerf("ask_request_total", askRequestStartedAt, {
            mode: "sse_income_ideas_cache",
            turnsUsed: 0
          });
          recordAskLatencyIfEnabled("sse_income_ideas_cache");
          logXchatAskStreamDebug({
            sseEvent: "done",
            requestId,
            correlationId,
            elapsedMs: Date.now() - cacheStreamStartedRef.at,
            turnsUsed: 0,
            deltaChars: cachedIncomeIdeas.length
          });
        }
      });
      const cacheSseHeaders = new Headers(limiterHeadCached);
      cacheSseHeaders.set("content-type", "text/event-stream; charset=utf-8");
      cacheSseHeaders.set("cache-control", "no-cache, no-transform");
      cacheSseHeaders.set("connection", "keep-alive");
      cacheSseHeaders.set("x-accel-buffering", "no");
      return new NextResponse(cacheStream, { headers: cacheSseHeaders });
    }
  }

  if (liveToolLoopSse) {
    const heartbeatMs = resolveXchatSseHeartbeatMs();
    const limiterHead = buildLimiterHeaders({
      remainingMinute: limiterRemainingMinute,
      remainingHour: limiterRemainingHour,
      remainingDay: limiterRemainingDay,
      hourlyLimit: limiterHourlyLimit,
      dailyLimit: limiterDailyLimit
    });
    const stream = createXchatLiveSseReadableStream({
      heartbeatMs,
      run: async (emit) => {
        const streamStarted = Date.now();
        emit.meta({
          v: 1,
          phase: "live_tool_loop",
          threadId: threadId ?? "",
          model: executionModel,
          personaId: persona._id?.toHexString() ?? ""
        });
        logXchatAskStreamDebug({
          sseEvent: "meta",
          requestId,
          correlationId,
          phase: "live_tool_loop"
        });
        let loopResult: XaiToolLoopResult;
        const toolLoopStartedAt = Date.now();
        try {
          loopResult = await respondWithXaiToolLoop({
            ...toolLoopShared,
            onLocalToolBatchComplete: (payload) => {
              logXchatAskToolBatchDebug({
                correlationId,
                requestId,
                ...payload
              });
              emit.tool_status({
                phase: "local_complete",
                turnIndex: payload.turnIndex,
                tools: payload.calls.map((c) => c.name),
                ...(payload.calls.some((c) => c.error)
                  ? {
                      errors: payload.calls
                        .filter((c) => c.error)
                        .map((c) => ({ name: c.name, error: c.error }))
                    }
                  : {})
              });
              logXchatAskStreamDebug({
                sseEvent: "tool_status",
                requestId,
                kind: "local_complete",
                turnIndex: payload.turnIndex,
                toolCount: payload.parallelLocalCount
              });
            },
            streamHooks: {
              onTurnStart: (idx) => {
                emit.turn({ index: idx });
                logXchatAskStreamDebug({
                  sseEvent: "turn_start",
                  requestId,
                  turnIndex: idx,
                  elapsedMs: Date.now() - streamStarted
                });
              },
              onTextDelta: (c) => emit.delta({ c }),
              onProviderHeaders: (h) => {
                emit.provider({
                  grokConvId: h.get("x-grok-conv-id") ?? undefined,
                  promptCache:
                    h.get("x-prompt-cache-hits") ??
                    h.get("x-prompt-cache") ??
                    h.get("x-cache") ??
                    undefined
                });
                logXchatAskStreamDebug({
                  sseEvent: "provider_headers",
                  requestId,
                  hasGrokConvId: Boolean(h.get("x-grok-conv-id")?.trim())
                });
              },
              onResponsesStreamEvent: (o) => {
                const summary = summarizeToolLikeStreamEvent(o);
                if (summary) {
                  emit.tool_status(summary);
                  logXchatAskStreamDebug({
                    sseEvent: "tool_status_upstream",
                    requestId,
                    streamType: summary.streamType
                  });
                }
              }
            }
          });
        } catch (error) {
          const aborted =
            request.signal.aborted ||
            (error instanceof DOMException && error.name === "AbortError") ||
            (error instanceof Error && error.name === "AbortError");
          if (aborted) {
            emit.error({ message: "Request cancelled", code: "request_aborted" });
            logXchatAskStreamDebug({
              sseEvent: "error",
              requestId,
              code: "request_aborted",
              elapsedMs: Date.now() - streamStarted
            });
            return;
          }
          const errMsg = error instanceof Error ? error.message : "Unknown provider error";
          console.error("[xchat/ask] xAI provider call failed", {
            mode: "responses_tool_loop_sse",
            personaId: persona?._id?.toHexString(),
            error: errMsg
          });
          logXchatAskProviderErrorDebug({
            personaId: persona?._id?.toHexString(),
            personaName: persona?.name,
            error: errMsg,
            wireTools: buildWireToolsForXaiResponses(xapiConfig.tools)
          });
          emit.error({
            message: summarizeProviderErrorForClient(errMsg),
            code: "provider_error"
          });
          logXchatAskStreamDebug({
            sseEvent: "error",
            requestId,
            code: "provider_error",
            elapsedMs: Date.now() - streamStarted
          });
          return;
        }

        if (incomeIdeasCacheKey && loopResult.outputText.trim().length > 0) {
          void setIncomeIdeasResponseCache(incomeIdeasCacheKey, loopResult.outputText);
        }

        const finalizeRes = await completeXchatAskAfterModelLoop(loopResult, askCompleteCtx());
        const finalizeJson = (await finalizeRes.json()) as { data?: Record<string, unknown> };
        const data = finalizeJson.data;
        if (!data || typeof data !== "object") {
          emit.error({ message: "finalize_failed", code: "internal_error" });
          logXchatAskStreamDebug({
            sseEvent: "error",
            requestId,
            code: "finalize_failed",
            elapsedMs: Date.now() - streamStarted
          });
          return;
        }
        emit.done(data as Record<string, unknown>);
        markPerf("sse_tool_loop_total", toolLoopStartedAt, {
          turnsUsed: loopResult.turnsUsed,
          outputChars: loopResult.outputText.length
        });
        markPerf("ask_request_total", askRequestStartedAt, {
          mode: "sse",
          turnsUsed: loopResult.turnsUsed
        });
        recordAskLatencyIfEnabled("sse");
        logXchatAskStreamDebug({
          sseEvent: "done",
          requestId,
          correlationId,
          elapsedMs: Date.now() - streamStarted,
          turnsUsed: loopResult.turnsUsed,
          deltaChars: loopResult.outputText.length
        });
      }
    });
    const sseHeaders = new Headers(limiterHead);
    sseHeaders.set("content-type", "text/event-stream; charset=utf-8");
    sseHeaders.set("cache-control", "no-cache, no-transform");
    sseHeaders.set("connection", "keep-alive");
    sseHeaders.set("x-accel-buffering", "no");
    return new NextResponse(stream, { headers: sseHeaders });
  }

  const toolLoopStartedAt = Date.now();
  try {
    const loopResult = await respondWithXaiToolLoop({
      ...toolLoopShared,
      onLocalToolBatchComplete: (payload) => {
        logXchatAskToolBatchDebug({
          correlationId,
          requestId,
          ...payload
        });
      }
    });
    if (incomeIdeasCacheKey && loopResult.outputText.trim().length > 0) {
      void setIncomeIdeasResponseCache(incomeIdeasCacheKey, loopResult.outputText);
    }
    markPerf("tool_loop_total", toolLoopStartedAt, {
      turnsUsed: loopResult.turnsUsed,
      outputChars: loopResult.outputText.length
    });
    markPerf("ask_request_total", askRequestStartedAt, {
      mode: "json",
      turnsUsed: loopResult.turnsUsed
    });
    recordAskLatencyIfEnabled("json");
    return completeXchatAskAfterModelLoop(loopResult, askCompleteCtx());
  } catch (error) {
    return handleToolLoopFailure(error);
  }
  });
}

function chunkIncomeIdeasCacheForSse(input: string, maxChars: number): string[] {
  const text = input.trim();
  if (!text) {
    return [""];
  }
  const out: string[] = [];
  for (let i = 0; i < text.length; i += maxChars) {
    out.push(text.slice(i, i + maxChars));
  }
  return out;
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
  if (!MULTI_AGENT_PERSONA_MODEL_IDS.has(input.model)) {
    if (
      input.reasoningEffort !== undefined &&
      input.reasoningEffort !== "none"
    ) {
      return {
        ok: false,
        error:
          "reasoningEffort is only supported with grok-4.20-multi-agent or grok-4.20-multi-agent-0309",
        code: "invalid_reasoning_effort"
      };
    }
    return { ok: true, config: undefined };
  }

  if (input.reasoningEffort === "none") {
    return {
      ok: false,
      error:
        "reasoningEffort none is only valid when routing to grok-4.3 (non-multi-agent personas).",
      code: "invalid_reasoning_effort"
    };
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
  remainingHour?: number;
  remainingDay?: number;
  hourlyLimit?: number;
  dailyLimit?: number;
  retryAfterSeconds?: number;
}): HeadersInit {
  const headers: Record<string, string> = {};
  if (typeof input.remainingMinute === "number") {
    headers["x-xchat-limit-remaining-minute"] = String(Math.max(0, input.remainingMinute));
  }
  if (typeof input.remainingHour === "number") {
    headers["x-xchat-limit-remaining-hour"] = String(Math.max(0, input.remainingHour));
  }
  if (typeof input.remainingDay === "number") {
    headers["x-xchat-limit-remaining-day"] = String(Math.max(0, input.remainingDay));
  }
  if (typeof input.hourlyLimit === "number") {
    headers["x-xchat-limit-hourly"] = String(Math.max(0, input.hourlyLimit));
  }
  if (typeof input.dailyLimit === "number") {
    headers["x-xchat-limit-daily"] = String(Math.max(0, input.dailyLimit));
  }
  if (typeof input.retryAfterSeconds === "number") {
    headers["retry-after"] = String(Math.max(1, Math.ceil(input.retryAfterSeconds)));
  }
  return headers;
}
