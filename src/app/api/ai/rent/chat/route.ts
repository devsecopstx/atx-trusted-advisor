import { z } from "zod";

import { preprocessXchatMarkdown } from "@/app/xchat/ui/xchat-markdown-preprocess";
import { getDb } from "@/lib/mongodb";
import { respondWithXaiToolLoop } from "@/lib/xai";
import { extractXaiResponsesUsage } from "@/lib/xai-usage-extract";
import { logRentalAiAudit } from "@/modules/platform/rental-ai-audit";
import { authenticateRentalAiApiKey } from "@/modules/platform/rental-ai-auth";
import {
    enforceRentalAiRateLimit,
    enforceRentalAiTokenBudget,
    releaseRentalAiConcurrencySafe,
    tryAcquireRentalAiConcurrencyOr429
} from "@/modules/platform/rental-ai-guardrails";
import {
    mergeRentalAiHeaders,
    rentalAiBaseHeaders,
    rentalAiJsonResponse,
    resolveCorrelationId
} from "@/modules/platform/rental-ai-http";
import {
    getRentalAiTokensUsedToday,
    incrementRentalAiTokensUsed
} from "@/modules/platform/rental-ai-token-meter";
import { createXfinanceToolExecutor } from "@/modules/xchat/tool-executor";
import {
    ensureSuperAgentDefaultTools,
    normalizePersonaXapiConfig,
    type PersonaConfig
} from "@/modules/xchat/types";
import { buildWorkspaceServerSnapshotBlock } from "@/modules/xchat/workspace-snapshot-for-prompt";

export const maxDuration = 45;

const bodySchema = z.object({
  message: z.string().min(1).max(32_000),
  portfolioId: z.string().regex(/^[a-f0-9]{24}$/).optional(),
  stream: z.boolean().optional()
});

export async function POST(request: Request) {
  const correlationId = resolveCorrelationId(request);
  const base = rentalAiBaseHeaders();

  const auth = await authenticateRentalAiApiKey(request.headers.get("authorization"), "chat");
  if (!auth.ok) {
    return rentalAiJsonResponse(
      { error: auth.message, code: auth.code, correlationId },
      auth.status
    );
  }

  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return rentalAiJsonResponse({ error: "Invalid JSON", code: "invalid_json", correlationId }, 400);
  }

  const parsedBody = bodySchema.safeParse(json);
  if (!parsedBody.success) {
    return rentalAiJsonResponse(
      {
        error: "Validation failed",
        code: "validation_error",
        correlationId,
        issues: parsedBody.error.flatten()
      },
      400
    );
  }

  const tenantHex = auth.ctx.tenantId.toHexString();
  const streamRequested =
    request.headers.get("accept")?.toLowerCase().includes("text/event-stream") ||
    parsedBody.data.stream === true;

  const rl = await enforceRentalAiRateLimit(request, tenantHex, "chat");
  if (rl) {
    const headers = mergeRentalAiHeaders(base, rl.response.headers);
    return new Response(rl.response.body, { status: rl.response.status, headers });
  }

  const budget = await enforceRentalAiTokenBudget({
    tenantIdHex: tenantHex,
    maxDailyTokens: auth.ctx.rentalProfile.maxDailyTokens
  });
  if (budget) {
    const headers = mergeRentalAiHeaders(base, budget.response.headers);
    return new Response(budget.response.body, { status: budget.response.status, headers });
  }

  const conc = await tryAcquireRentalAiConcurrencyOr429(tenantHex);
  if ("failure" in conc) {
    const headers = mergeRentalAiHeaders(base, conc.failure.response.headers);
    return new Response(conc.failure.response.body, {
      status: conc.failure.response.status,
      headers
    });
  }
  const { slot } = conc;

  try {
    const db = await getDb();
    const rentalProfile = auth.ctx.rentalProfile;
    const sampleUserId = rentalProfile.sampleUserId ?? `rental-sample:${auth.ctx.tenantSlug}`;
    const requestedPortfolioId = parsedBody.data.portfolioId?.trim() || undefined;
    const workspacePortfolioId =
      requestedPortfolioId ??
      (rentalProfile.samplePortfolioId ? rentalProfile.samplePortfolioId.toHexString() : undefined);
    const workspaceSnapshot = await buildWorkspaceServerSnapshotBlock({
      userId: sampleUserId,
      tenantId: tenantHex,
      workspacePortfolioId
    });
    let systemPrompt =
      "You are a white-labeled xFinance rental advisor for a tenant workspace. " +
      "Keep responses concise, institutional, and options-aware. Not financial advice.";
    const personaId = rentalProfile.defaultPersonaId;
    if (personaId) {
      const persona = (await db.collection("xchat_personas").findOne({
        _id: personaId
      })) as PersonaConfig | null;
      if (persona?.systemPrompt?.trim()) {
        systemPrompt = persona.systemPrompt.trim();
      }
    }
    const xapiConfig = ensureSuperAgentDefaultTools(
      normalizePersonaXapiConfig({
        mode: "responses",
        toolChoice: "auto",
        maxTurns: 5,
        tools: [{ type: "atx_function" }, { type: "yahoo_finance" }]
      }),
      "advisor"
    );
    const finalSystemPrompt = [
      systemPrompt,
      `Rental strategy bias: ${rentalProfile.strategyBias}.`,
      workspaceSnapshot ?? "Workspace snapshot is unavailable for this tenant right now."
    ].join("\n\n");
    const loopResult = await respondWithXaiToolLoop({
      model: rentalProfile.xaiModelOverride,
      systemPrompt: finalSystemPrompt,
      userPrompt: parsedBody.data.message.trim(),
      tools: xapiConfig.tools,
      toolChoice: xapiConfig.toolChoice,
      maxTurns: xapiConfig.maxTurns,
      executor: createXfinanceToolExecutor({
        userId: sampleUserId,
        tenantId: tenantHex,
        workspacePortfolioId
      }),
      signal: request.signal
    });
    const usageSnapshot = extractXaiResponsesUsage(loopResult.raw);
    const responseMarkdown = preprocessXchatMarkdown(loopResult.outputText);
    const tokensUsed = Math.max(1, usageSnapshot?.totalTokens ?? 4096);
    await incrementRentalAiTokensUsed(auth.ctx.tenantId, tokensUsed);
    const usedNow = await getRentalAiTokensUsedToday(auth.ctx.tenantId);
    const remaining = Math.max(0, rentalProfile.maxDailyTokens - usedNow);
    const successHeaders = mergeRentalAiHeaders(base, {
      "x-rental-tokens-used": String(usedNow),
      "x-rental-tokens-remaining": String(remaining)
    });
    await logRentalAiAudit({
      ctx: auth.ctx,
      correlationId,
      action: "rental_ai_chat_request",
      details: {
        portfolioId: parsedBody.data.portfolioId,
        stream: streamRequested,
        tokensUsed
      }
    });
    if (streamRequested) {
      const encoder = new TextEncoder();
      const created = Math.floor(Date.now() / 1000);
      const chunkId = `chatcmpl-rental-${correlationId}`;
      const payloadChunks = chunkTextForSse(responseMarkdown, 160);
      const stream = new ReadableStream<Uint8Array>({
        start(controller) {
          controller.enqueue(
            encoder.encode(
              `data: ${JSON.stringify({
                id: chunkId,
                object: "chat.completion.chunk",
                created,
                model: loopResult.model,
                choices: [{ index: 0, delta: { role: "assistant" }, finish_reason: null }]
              })}\n\n`
            )
          );
          for (const piece of payloadChunks) {
            controller.enqueue(
              encoder.encode(
                `data: ${JSON.stringify({
                  id: chunkId,
                  object: "chat.completion.chunk",
                  created,
                  model: loopResult.model,
                  choices: [{ index: 0, delta: { content: piece }, finish_reason: null }]
                })}\n\n`
              )
            );
          }
          controller.enqueue(
            encoder.encode(
              `data: ${JSON.stringify({
                id: chunkId,
                object: "chat.completion.chunk",
                created,
                model: loopResult.model,
                choices: [{ index: 0, delta: {}, finish_reason: "stop" }]
              })}\n\n`
            )
          );
          controller.enqueue(encoder.encode("data: [DONE]\n\n"));
          controller.close();
        }
      });
      successHeaders.set("content-type", "text/event-stream; charset=utf-8");
      successHeaders.set("cache-control", "no-cache, no-transform");
      successHeaders.set("connection", "keep-alive");
      return new Response(stream, { status: 200, headers: successHeaders });
    }
    return rentalAiJsonResponse(
      {
        ok: true,
        correlationId,
        tenantSlug: auth.ctx.tenantSlug,
        data: {
          response: responseMarkdown,
          model: loopResult.model,
          usage: usageSnapshot ?? {
            inputTokens: 0,
            outputTokens: 0,
            totalTokens: tokensUsed
          }
        }
      },
      200,
      successHeaders
    );
  } finally {
    await releaseRentalAiConcurrencySafe(tenantHex, slot);
  }
}

function chunkTextForSse(input: string, maxChars: number): string[] {
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
