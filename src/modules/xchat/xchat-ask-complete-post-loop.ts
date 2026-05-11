import type { ObjectId } from "mongodb";
import { NextResponse } from "next/server";
import { createHash } from "node:crypto";

import { preprocessXchatMarkdown } from "@/app/xchat/ui/xchat-markdown-preprocess";
import type { SessionUser } from "@/lib/auth";
import type { ToolCallLog, XaiToolLoopResult } from "@/lib/xai";
import { extractXaiResponsesUsage } from "@/lib/xai-usage-extract";
import { logXchatAskDebug, logXchatAskFullPayload } from "@/lib/xchat-debug";
import { createAuditEvent } from "@/modules/audit/repository";
import { saveXChatLog } from "@/modules/xchat/repository";
import { fireAndForgetRecordXchatToolUsage } from "@/modules/xchat/tool-usage-repository";
import type { PersonaXapiConfig, XChatXaiUsageSnapshot } from "@/modules/xchat/types";

type AskModelSelectionSource =
  | "default"
  | "persona"
  | "vision_env"
  | "reasoning_mode"
  | "reasoning_mode_fallback"
  | "reasoning_effort";

export type XchatAskCompletePostLoopCtx = {
  session: SessionUser;
  persona: { _id?: ObjectId; name: string };
  threadId: string | undefined;
  messageForPersistence: string;
  systemPrompt: string;
  userPrompt: string;
  ragContext: string;
  contextSource: "none" | "xai_collection";
  contextCount: number;
  xapiConfig: PersonaXapiConfig;
  executionModel: string;
  scope: string;
  linkedCollectionIds: string[];
  collectionSearchStatus: string | undefined;
  collectionSearchNonReadyFileCount: number | undefined;
  correlationId: string | undefined;
  requestId: string;
  userId: ObjectId;
  tenantId: ObjectId | null;
  shouldPersistHistory: boolean;
  retentionExpiresAt: Date | undefined;
  strategyJobOptOut: boolean;
  remoteChainInstructionsFingerprint: string | undefined;
  collectionContextReferences: Array<{
    documentId?: string;
    documentName?: string;
    snippetFingerprint: string;
  }>;
  askProcessingStartedAt: number;
  modelSelectionSource: AskModelSelectionSource;
  multiAgentDowngraded: boolean;
  effectiveModel: string | undefined;
  remoteHistoryContinuation: boolean;
  enableLongTermXaiMemory: boolean;
  xaiPreviousResponseIdUsed?: string;
  limiterRemainingMinute: number | undefined;
  limiterRemainingHour: number | undefined;
  limiterRemainingDay: number | undefined;
  limiterHourlyLimit: number | undefined;
  limiterDailyLimit: number | undefined;
};

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

function buildSha256Hex(input: string): string {
  return createHash("sha256").update(input).digest("hex");
}

function buildXchatAskInteractionMeta(
  startedAt: number,
  parts: {
    ragChunks: number;
    toolInvocations: number;
    personaCollections: number;
  }
): {
  generationMs: number;
  sources: {
    ragChunks: number;
    toolInvocations: number;
    personaCollections: number;
    total: number;
  };
} {
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

type XchatAskDataWithTiming = {
  response: string;
  model: string;
  personaName: string;
  modelSelectionSource: AskModelSelectionSource;
  contextCount: number;
  contextSource: "none" | "xai_collection";
  collectionSearchStatus?: string;
  collectionSearchNonReadyFileCount?: number;
  logId?: string;
  toolCalls?: Array<{ name: string; durationMs: number }>;
  multiAgentDowngraded?: true;
  personaModelRequested?: string;
  xaiUsage?: Record<string, unknown>;
  contextRetainedFromPriorTurns?: boolean;
  interactionMeta: ReturnType<typeof buildXchatAskInteractionMeta>;
};

type XchatAskResponseMetadataWire = {
  durationMs: number;
  sourcesUsed: number;
  threadId: string;
  model: string;
  personaId: string;
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

/** Persistence + JSON envelope after `respondWithXaiToolLoop` (shared by JSON ask + SSE `done`). */
export async function completeXchatAskAfterModelLoop(
  lr: XaiToolLoopResult,
  ctx: XchatAskCompletePostLoopCtx
): Promise<NextResponse> {
  const xaiUsageSnapshot: XChatXaiUsageSnapshot | undefined = extractXaiResponsesUsage(lr.raw);
  const xaiResponse = { outputText: lr.outputText, model: lr.model };
  const toolCallLogs: ToolCallLog[] = lr.toolCalls;
  const previousResponseId = lr.responseId;

  const responseMarkdown = preprocessXchatMarkdown(xaiResponse.outputText);

  const contextChunkIds: ObjectId[] = [];

  logXchatAskDebug({
    userId: ctx.session.userId,
    email: ctx.session.email,
    personaId: ctx.persona?._id?.toHexString(),
    personaName: ctx.persona?.name,
    message: ctx.messageForPersistence,
    systemPrompt: ctx.systemPrompt,
    userPrompt: ctx.userPrompt,
    ragContextLength: ctx.ragContext.length,
    contextSource: ctx.contextSource,
    contextCount: ctx.contextCount,
    tools: ctx.xapiConfig.tools.map((t) => t.type),
    model: ctx.executionModel,
    responseLength: responseMarkdown.length,
    mode: ctx.xapiConfig.mode,
    scope: ctx.scope,
    collectionId: ctx.linkedCollectionIds[0],
    toolCallCount: toolCallLogs.length,
    modelSelectionSource: ctx.modelSelectionSource
  });
  logXchatAskFullPayload({
    userId: ctx.session.userId,
    personaName: ctx.persona?.name,
    systemPrompt: ctx.systemPrompt,
    userPrompt: ctx.userPrompt,
    ragContext: ctx.ragContext,
    tools: ctx.xapiConfig.tools.map((t) => t.type),
    model: ctx.executionModel,
    responseText: xaiResponse.outputText
  });

  try {
    await createAuditEvent({
      entityType: "xchat_session",
      entityId: ctx.requestId,
      action: "xchat_turn_pending_xai_sync",
      actor: {
        userId: ctx.session.userId,
        email: ctx.session.email,
        username: ctx.session.username
      },
      details: {
        correlationId: ctx.correlationId,
        userIdMasked: maskIdentifier(ctx.session.userId),
        tenantIdMasked: maskIdentifier(ctx.session.tenantId),
        personaId: ctx.persona?._id?.toHexString(),
        model: xaiResponse.model,
        scope: ctx.scope,
        historyPolicy: ctx.shouldPersistHistory ? "opt_in_keep_last_10" : "ephemeral_only",
        enableLongTermXaiMemory: ctx.enableLongTermXaiMemory,
        xaiPreviousResponseId: ctx.xaiPreviousResponseIdUsed ?? null,
        note: ctx.shouldPersistHistory
          ? "Turn stored in xchat_logs with rolling last-10 policy and 60-day TTL."
          : "No xchat_logs persistence; continuity comes from recent thread messages in the request."
      }
    });
  } catch (auditError) {
    console.error("[xchat/ask] failed to write xchat turn audit event", {
      requestId: ctx.requestId,
      correlationId: ctx.correlationId,
      error: auditError instanceof Error ? auditError.message : String(auditError)
    });
  }

  const mainLoopMeta = buildXchatAskInteractionMeta(ctx.askProcessingStartedAt, {
    ragChunks: ctx.contextCount,
    toolInvocations: toolCallLogs.length,
    personaCollections: ctx.linkedCollectionIds.length
  });

  const chatLogId = ctx.shouldPersistHistory
    ? await saveXChatLog({
        threadId: ctx.threadId,
        requestId: ctx.requestId,
        correlationId: ctx.correlationId ?? "",
        userId: ctx.userId,
        tenantId: ctx.tenantId ?? undefined,
        userEmail: ctx.session.email,
        requestedBy: ctx.session.username,
        personaId: ctx.persona?._id,
        personaName: ctx.persona.name,
        scope: ctx.scope,
        message: ctx.messageForPersistence,
        response: responseMarkdown,
        contextChunkIds,
        model: xaiResponse.model,
        xaiUsage: xaiUsageSnapshot,
        xaiResponseId: previousResponseId,
        xapiMode: ctx.xapiConfig.mode,
        xapiToolChoice: ctx.xapiConfig.toolChoice,
        xapiMaxTurns: ctx.xapiConfig.maxTurns,
        xapiToolCount: ctx.xapiConfig.tools.length,
        collectionContextReferences: ctx.collectionContextReferences,
        xapiToolCalls:
          toolCallLogs.length > 0
            ? toolCallLogs.map((tc) => ({
                name: tc.name,
                args: tc.args,
                resultHash: buildSha256Hex(tc.result),
                durationMs: tc.durationMs,
                error: tc.error
              }))
            : undefined,
        strategyJobOptOut: ctx.strategyJobOptOut,
        retentionExpiresAt: ctx.retentionExpiresAt,
        interactionGenerationMs: mainLoopMeta.generationMs,
        xchatInstructionsFingerprint: ctx.remoteChainInstructionsFingerprint
      })
    : null;

  fireAndForgetRecordXchatToolUsage({
    userId: ctx.session.userId,
    tenantId: ctx.tenantId ?? undefined,
    personaId: ctx.persona?._id?.toHexString(),
    personaName: ctx.persona?.name,
    requestId: ctx.requestId,
    toolCalls: toolCallLogs
  });

  return NextResponse.json(
    {
      data: withXchatAskContentAndMetadata(
        {
          response: responseMarkdown,
          model: xaiResponse.model,
          personaName: ctx.persona.name,
          modelSelectionSource: ctx.modelSelectionSource,
          contextCount: ctx.contextCount,
          contextSource: ctx.contextSource,
          collectionSearchStatus: ctx.collectionSearchStatus,
          collectionSearchNonReadyFileCount: ctx.collectionSearchNonReadyFileCount,
          logId: chatLogId?.toHexString(),
          toolCalls:
            toolCallLogs.length > 0
              ? toolCallLogs.map((tc) => ({ name: tc.name, durationMs: tc.durationMs }))
              : undefined,
          ...(ctx.multiAgentDowngraded
            ? { multiAgentDowngraded: true as const, personaModelRequested: ctx.effectiveModel }
            : {}),
          ...(xaiUsageSnapshot
            ? {
                xaiUsage: {
                  inputTokens: xaiUsageSnapshot.inputTokens,
                  outputTokens: xaiUsageSnapshot.outputTokens,
                  totalTokens: xaiUsageSnapshot.totalTokens,
                  ...(xaiUsageSnapshot.reasoningTokens != null && xaiUsageSnapshot.reasoningTokens > 0
                    ? { reasoningTokens: xaiUsageSnapshot.reasoningTokens }
                    : {}),
                  ...(xaiUsageSnapshot.cachedPromptTokens != null &&
                  xaiUsageSnapshot.cachedPromptTokens > 0
                    ? { cachedPromptTokens: xaiUsageSnapshot.cachedPromptTokens }
                    : {}),
                  ...(xaiUsageSnapshot.costUsdTicks != null && xaiUsageSnapshot.costUsdTicks > 0
                    ? { costUsdTicks: xaiUsageSnapshot.costUsdTicks }
                    : {})
                }
              }
            : {}),
          ...(ctx.remoteHistoryContinuation ? { contextRetainedFromPriorTurns: true } : {}),
          interactionMeta: mainLoopMeta
        },
        { persona: ctx.persona, threadId: ctx.threadId }
      )
    },
    {
      headers: buildLimiterHeaders({
        remainingMinute: ctx.limiterRemainingMinute,
        remainingHour: ctx.limiterRemainingHour,
        remainingDay: ctx.limiterRemainingDay,
        hourlyLimit: ctx.limiterHourlyLimit,
        dailyLimit: ctx.limiterDailyLimit
      })
    }
  );
}
