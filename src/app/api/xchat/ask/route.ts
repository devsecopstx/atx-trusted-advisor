import { ObjectId } from "mongodb";
import { NextResponse } from "next/server";
import { createHash } from "node:crypto";
import { z } from "zod";

import { preprocessXchatMarkdown } from "@/app/xchat/ui/xchat-markdown-preprocess";
import {
    isBillingEntitledAccessState,
    resolveAppUserBillingAccessState
} from "@/lib/app-user-billing-state";
import { requireSessionUser } from "@/lib/auth";
import { isXchatRemoteHistoryEnabled, readXaiVisionModelOverrideFromEnv } from "@/lib/env";
import {
    getPersonaByIdCached,
    getTenantByHexIdCached,
    loadDefaultXchatPersonaForSessionDeduped
} from "@/lib/server-request-cache";
import {
    effectiveWorkspaceLimitsForTenantAndPlan,
} from "@/lib/tenant-workspace-limits";
import {
    respondWithXaiToolLoop,
    searchDocumentsInCollections,
    type ToolCallLog
} from "@/lib/xai";
import { getDefaultPersonaChatModelId } from "@/lib/xai-default-persona-model";
import { buildWireToolsForXaiResponses, personaXapiToolsToXaiRequestTools } from "@/lib/xai-tools";
import { extractXaiResponsesUsage } from "@/lib/xai-usage-extract";
import {
    logXchatAskDebug,
    logXchatAskFullPayload,
    logXchatAskPreRequestDebug,
    logXchatAskProviderErrorDebug
} from "@/lib/xchat-debug";
import { runWithXchatTenantDebugAsync } from "@/lib/xchat-debug-context";
import { createAuditEvent } from "@/modules/audit/repository";
import { getUserAdminSettings } from "@/modules/core-admin/repository";
import { canUserLogin, isGlobalAdmin } from "@/modules/identity/authorization";
import {
    getCoreUserById,
    getCoreUserOptionsScanPreferences,
    updateCoreUserOptionsScanPreferences
} from "@/modules/identity/repository";
import { isTenantXchatDebugPreferenceEnabled } from "@/modules/identity/tenant-branding-preferences";
import type { SubscriptionPlan } from "@/modules/identity/types";
import { enforceDistributedAskUsageLimit } from "@/modules/xchat/ask-usage-limits";
import { appendXchatKbMetadata } from "@/modules/xchat/batch-prompt-context";
import { XPERSONA_GLOBAL_ADMIN_DEFAULT_NAME_KEYS } from "@/modules/xchat/default-xpersonas";
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
import { clampMultiAgentParallelismForPlan, clampTopK } from "@/modules/xchat/plan-limits";
import { getScopeReadinessSummary } from "@/modules/xchat/rag-file-readiness";
import {
    getLatestXchatLogByThread,
    saveXChatLog
} from "@/modules/xchat/repository";
import { createXfinanceToolExecutor } from "@/modules/xchat/tool-executor";
import { fireAndForgetRecordXchatToolUsage } from "@/modules/xchat/tool-usage-repository";
import type { XChatXaiUsageSnapshot } from "@/modules/xchat/types";
import {
    ensureSuperAgentDefaultTools,
    isAtxFunctionToolType,
    mergeXchatHostedToolBaseline,
    normalizePersonaXapiConfig,
    type PersonaXapiConfig
} from "@/modules/xchat/types";
import { getXchatUserPreferences } from "@/modules/xchat/user-preferences-repository";
import { postProcessWatchlistMarkdown } from "@/modules/xchat/watchlist-response-postprocess";
import { verifyXaiCollectionNonBlocking } from "@/modules/xchat/xai-collection-verifier";
import {
    collectWatchlistPortfolioIdSlot,
    heavySynthesisIntent,
    isShowWatchlistIntent,
    shouldOfferStrategyJobPreflight,
    shouldRunOptionsActionScan,
    STRATEGY_JOB_PREFLIGHT_MARKDOWN
} from "@/modules/xchat/xchat-ask-routing";
import {
    MAX_XCHAT_ASK_JSON_BYTES,
    parseAndValidateXchatPasteImage
} from "@/modules/xchat/xchat-image-attachment";
import {
    buildSessionToolInstructions,
    buildXchatSystemPrompt,
    computeXchatRemoteChainInstructionsFingerprint,
    XCHAT_SERVER_ROUTING_POLICY_BLOCK
} from "@/modules/xchat/xchat-prompt-build";
import {
    buildRecentThreadMessagesPromptBlock,
    type XchatRecentThreadMessage
} from "@/modules/xchat/xchat-recent-history-prompt";

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
      .max(10)
      .optional(),
    portfolioId: z.string().trim().regex(/^[a-f\d]{24}$/i).optional(),
    personaId: z.string().optional(),
    reasoningEffort: z.enum(["low", "medium", "high", "xhigh"]).optional(),
    scope: z.string().min(1).max(128).optional(),
    topK: z.number().int().min(1).max(10).optional()
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
  });
const ASK_RATE_MAX = 20;
const XCHAT_OPT_IN_RETENTION_DAYS = 60;
const STRATEGY_OPTOUT_SYSTEM_PROMPT_LINE =
  "User has explicitly chosen to stay in normal chat mode. Do NOT offer or mention strategy jobs, xStrategyBuilder, or the Spring orchestrator again in this conversation. Answer directly using tools, RAG, and portfolio context only. Keep full conversation history.";
const APP_USER_BLOCKED_PERSONA_KEYS = new Set<string>(
  XPERSONA_GLOBAL_ADMIN_DEFAULT_NAME_KEYS.map((k) => normalizeNameKey(k))
);

type ModelSelectionSource = "default" | "persona" | "vision_env";
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

export async function POST(request: Request) {
  const session = await requireSessionUser();
  if (session instanceof NextResponse) {
    return session;
  }

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
  if (!isAdminSession && !isBillingEntitledAccessState(billingState)) {
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

  return runWithXchatTenantDebugAsync(tenantDebugFlag, async () => {
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

  const xchatImageCaptionFallback =
    "Analyze this screenshot or pasted image. If it shows tickers, options, charts, or portfolio data, describe what you see and anything actionable. If it is not finance-related, say so briefly.";
  const captionForPrompt = messageTrimmed || (visionImage ? xchatImageCaptionFallback : "");
  const messageForPersistence = visionImage
    ? `[image:${visionImage.mediaType}] ${messageTrimmed || "(paste)"}`
    : messageRaw;
  const threadId = parsed.data.threadId?.trim() || undefined;
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
  let limiterRemainingMinute: number | undefined;
  let limiterRemainingHour: number | undefined;
  let limiterRemainingDay: number | undefined;
  let limiterHourlyLimit: number | undefined;
  let limiterDailyLimit: number | undefined;
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
    dailyPromptCap = xchatAskWorkspaceLimits.userChatLimit;
    const h = xchatAskWorkspaceLimits.userChatHourlyLimit;
    hourlyPromptCap = typeof h === "number" && h > 0 ? h : undefined;
  }
  try {
    const usageCheck = await enforceDistributedAskUsageLimit({
      userId: session.userId,
      tenantId: session.tenantId,
      plan: subscriptionPlan,
      perMinuteLimit: ASK_RATE_MAX,
      enforceDailyLimit: !isAdminSession,
      dailyPromptLimit: dailyPromptCap,
      hourlyPromptLimit: hourlyPromptCap
    });
    if (!usageCheck.allowed) {
      const limiterHeaders = buildLimiterHeaders({
        remainingMinute: usageCheck.remainingMinute,
        remainingHour: usageCheck.remainingHour,
        remainingDay: usageCheck.remainingDay,
        hourlyLimit: usageCheck.hourlyLimit,
        dailyLimit: usageCheck.dailyLimit,
        retryAfterSeconds: usageCheck.retryAfterSeconds
      });
      const limitError =
        usageCheck.code === "xchat_daily_limit_exceeded"
          ? "xChat daily prompt limit reached (UTC calendar day). Resets at next UTC midnight or contact your admin."
          : usageCheck.code === "xchat_hourly_limit_exceeded"
            ? "xChat hourly prompt limit reached (UTC hour window). Try again next hour or contact your admin."
            : "Rate limit exceeded";
      return NextResponse.json(
        {
          error: limitError,
          code: usageCheck.code,
          retryAfterSeconds: usageCheck.retryAfterSeconds ?? 60,
          ...(usageCheck.code === "xchat_daily_limit_exceeded" &&
          typeof usageCheck.dailyLimit === "number"
            ? {
                dailyLimit: usageCheck.dailyLimit,
                xchatLimitSource: "tenant_plan_effective" as const
              }
            : {}),
          ...(usageCheck.code === "xchat_hourly_limit_exceeded" &&
          typeof usageCheck.hourlyLimit === "number"
            ? { hourlyLimit: usageCheck.hourlyLimit }
            : {})
        },
        { status: 429, headers: limiterHeaders }
      );
    }
    limiterRemainingMinute = usageCheck.remainingMinute;
    limiterRemainingHour = usageCheck.remainingHour;
    limiterRemainingDay = usageCheck.remainingDay;
    limiterHourlyLimit = usageCheck.hourlyLimit;
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

  const personaModelRaw =
    typeof persona?.model === "string" ? persona.model.trim().slice(0, 128) : "";
  const effectiveModel =
    personaModelRaw.length > 0 ? personaModelRaw : getDefaultPersonaChatModelId();
  let modelSelectionSource: ModelSelectionSource =
    personaModelRaw.length > 0 ? "persona" : "default";

  let executionModel = effectiveModel;
  let multiAgentDowngraded = false;
  if (MULTI_AGENT_PERSONA_MODEL_IDS.has(effectiveModel)) {
    const allowParallelism =
      parsed.data.reasoningEffort != null || heavySynthesisIntent(messageTrimmed);
    if (!allowParallelism) {
      executionModel = getDefaultPersonaChatModelId();
      multiAgentDowngraded = true;
    }
  }

  const parallelAgentConfigResult = resolveParallelAgentConfig({
    model: executionModel,
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

  if (visionImage) {
    parallelAgentConfig = undefined;
    const visionModelOverride = readXaiVisionModelOverrideFromEnv();
    if (visionModelOverride) {
      executionModel = visionModelOverride;
      modelSelectionSource = "vision_env";
    } else if (MULTI_AGENT_PERSONA_MODEL_IDS.has(executionModel)) {
      /** Multi-agent + `input_image` is unreliable on `/v1/responses`; fall back to the default chat model for this turn. */
      executionModel = getDefaultPersonaChatModelId();
      modelSelectionSource = "default";
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
  const userPrefs = userId
    ? await getXchatUserPreferences({
        userId,
        tenantId
      })
    : null;
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
          retentionExpiresAt
        })
      : null;
    return NextResponse.json(
      {
        data: {
          response: responseMarkdown,
          strategyJobOffer: false,
          personaName: persona.name,
          modelSelectionSource,
          model: "strategy_job_opt_out",
          contextCount: 0,
          contextSource: "none",
          collectionSearchStatus: "skipped_no_collections",
          collectionSearchNonReadyFileCount: 0,
          logId: chatLogId?.toHexString()
        }
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
          retentionExpiresAt
        })
      : null;
    return NextResponse.json(
      {
        data: {
          response: responseMarkdown,
          strategyJobOffer: true,
          personaName: persona.name,
          modelSelectionSource,
          model: "strategy_job_preflight",
          contextCount: 0,
          contextSource: "none",
          collectionSearchStatus: "skipped_no_collections",
          collectionSearchNonReadyFileCount: 0,
          logId: chatLogId?.toHexString()
        }
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
          retentionExpiresAt
        })
      : null;
    return NextResponse.json(
      {
        data: {
          response: responseMarkdown,
          model: "watchlist_portfolio_slot_collection",
          personaName: persona.name,
          modelSelectionSource,
          contextCount: 0,
          contextSource: "none",
          collectionSearchStatus: "skipped_no_collections",
          collectionSearchNonReadyFileCount: 0,
          logId: chatLogId?.toHexString()
        }
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
          query: messageTrimmed || "User attached an image for analysis.",
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

  if (!visionImage && hasXfinanceTool && shouldRunOptionsActionScan(messageTrimmed)) {
    const executor = createXfinanceToolExecutor({
      userId: session.userId,
      tenantId: session.tenantId,
      subscriptionPlan,
      workspacePortfolioId,
      workspaceLazyLoad: {
        userId: session.userId,
        tenantId: session.tenantId,
        workspacePortfolioId
      }
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
        data: {
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
          toolCalls: [{ name: "atx_function", durationMs: optionsScanDurationMs }]
        }
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
      workspacePortfolioId,
      workspaceLazyLoad: {
        userId: session.userId,
        tenantId: session.tenantId,
        workspacePortfolioId
      }
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
        data: {
          response: output,
          model: "watchlist_snapshot_direct",
          personaName: persona.name,
          modelSelectionSource,
          contextCount: 0,
          contextSource: "none",
          collectionSearchStatus: "skipped_no_collections",
          collectionSearchNonReadyFileCount: 0,
          logId: chatLogId?.toHexString(),
          toolCalls: [{ name: "atx_function", durationMs: watchlistCallDurationMs }]
        }
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
    persona?.keepXchatHistory !== false &&
    Boolean(threadId) &&
    Boolean(userId) &&
    !visionImage;

  const remoteChainInstructionsFingerprint = computeXchatRemoteChainInstructionsFingerprint({
    personaSystem: persona?.systemPrompt ?? "",
    personaUpdatedAtMs: persona?.updatedAt?.getTime() ?? 0,
    strategyJobOptOut,
    hostedSearch: hasHostedSearchTool,
    atxFunction: hasXfinanceTool,
    citationsEnabled: persona?.citationsEnabled !== false
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
    .slice(-10);
  const recentHistoryBlock =
    useRemoteConversationHistory && previousResponseId
      ? ""
      : buildRecentThreadMessagesPromptBlock(recentThreadMessages, {
          maxMessages: 10
        });

  const builtSystemPrompt = buildXchatSystemPrompt({
    personaSystem: persona?.systemPrompt ?? "",
    fallbackPersonaSystem: "You are xchat, an operations-focused assistant for atxfinance core admins.",
    ragContext,
    recentHistoryBlock,
    workspaceSnapshot: null,
    sessionToolInstructions: buildSessionToolInstructions({
      hostedSearch: hasHostedSearchTool,
      atxFunction: hasXfinanceTool
    }),
    routingPolicyBlock: XCHAT_SERVER_ROUTING_POLICY_BLOCK,
    citationsEnabled: persona?.citationsEnabled !== false
  });
  const systemPrompt = strategyJobOptOut
    ? `${STRATEGY_OPTOUT_SYSTEM_PROMPT_LINE}\n\n${builtSystemPrompt}`
    : builtSystemPrompt;
  const userPromptTemplate = persona?.overridePrompt?.trim() ?? "";
  const userPromptBase = userPromptTemplate
    ? `${userPromptTemplate}\n\nUser message:\n${captionForPrompt}`
    : captionForPrompt;
  const personaKbAugmentation = appendXchatKbMetadata({
    tools: xapiConfig.tools,
    linkedCollectionIds,
    resolvedCollectionsLine: teamKbMetaLine
  });
  const userPrompt = `${userPromptBase}\n\n${personaKbAugmentation}`;
  let xaiResponse: { outputText: string; model: string };
  let toolCallLogs: ToolCallLog[] = [];
  let xaiUsageSnapshot: XChatXaiUsageSnapshot | undefined;

  const wireTools = buildWireToolsForXaiResponses(xapiConfig.tools);
  logXchatAskPreRequestDebug({
    personaId: persona?._id?.toHexString(),
    personaName: persona?.name,
    model: executionModel,
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
          subscriptionPlan,
          workspacePortfolioId,
          ...(hasXfinanceTool
            ? {
                workspaceLazyLoad: {
                  userId: session.userId,
                  tenantId: session.tenantId,
                  workspacePortfolioId
                }
              }
            : {})
        })
      : async () => ({
          result: "",
          error: "local_tool_not_configured_for_persona"
        });

    const loopResult = await respondWithXaiToolLoop({
      model: executionModel,
      systemPrompt,
      userPrompt,
      userImageDataUrl: visionImage?.dataUrl,
      tools: xaiTools,
      toolChoice: xapiConfig.toolChoice,
      maxTurns: xapiConfig.maxTurns,
      executor,
      parallelism: parallelAgentConfig,
      previousResponseId,
      storeMessages: useRemoteConversationHistory
    });
    xaiUsageSnapshot = extractXaiResponsesUsage(loopResult.raw);
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
    message: messageForPersistence,
    systemPrompt,
    userPrompt,
    ragContextLength: ragContext.length,
    contextSource,
    contextCount,
    tools: xapiConfig.tools.map((t) => t.type),
    model: executionModel,
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
    model: executionModel,
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
        historyPolicy: shouldPersistHistory ? "opt_in_keep_last_10" : "ephemeral_only",
        note: shouldPersistHistory
          ? "Turn stored in xchat_logs with rolling last-10 policy and 60-day TTL."
          : "No xchat_logs persistence; continuity comes from recent thread messages in the request."
      }
    });
  } catch (auditError) {
    console.error("[xchat/ask] failed to write xchat turn audit event", {
      requestId,
      correlationId,
      error: auditError instanceof Error ? auditError.message : String(auditError)
    });
  }

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
        contextChunkIds,
        model: xaiResponse.model,
        xaiUsage: xaiUsageSnapshot,
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
        strategyJobOptOut,
        retentionExpiresAt,
        xchatInstructionsFingerprint: remoteChainInstructionsFingerprint
      })
    : null;

  fireAndForgetRecordXchatToolUsage({
    userId: session.userId,
    tenantId: tenantId ?? undefined,
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
        logId: chatLogId?.toHexString(),
        toolCalls: toolCallLogs.length > 0
          ? toolCallLogs.map((tc) => ({ name: tc.name, durationMs: tc.durationMs }))
          : undefined,
        ...(multiAgentDowngraded
          ? { multiAgentDowngraded: true as const, personaModelRequested: effectiveModel }
          : {}),
        ...(xaiUsageSnapshot
          ? {
              xaiUsage: {
                inputTokens: xaiUsageSnapshot.inputTokens,
                outputTokens: xaiUsageSnapshot.outputTokens,
                totalTokens: xaiUsageSnapshot.totalTokens,
                ...(xaiUsageSnapshot.reasoningTokens != null &&
                xaiUsageSnapshot.reasoningTokens > 0
                  ? { reasoningTokens: xaiUsageSnapshot.reasoningTokens }
                  : {}),
                ...(xaiUsageSnapshot.cachedPromptTokens != null &&
                xaiUsageSnapshot.cachedPromptTokens > 0
                  ? { cachedPromptTokens: xaiUsageSnapshot.cachedPromptTokens }
                  : {})
              }
            }
          : {})
      }
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
  if (!MULTI_AGENT_PERSONA_MODEL_IDS.has(input.model)) {
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
