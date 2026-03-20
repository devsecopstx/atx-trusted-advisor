import { ObjectId } from "mongodb";
import { NextResponse } from "next/server";
import { z } from "zod";

import { requireSessionUser } from "@/lib/auth";
import { checkRateLimit } from "@/lib/rate-limit";
import { logXchatAskDebug, logXchatAskFullPayload } from "@/lib/xchat-debug";
import {
  chatWithXai,
  respondWithXai,
  respondWithXaiToolLoop,
  searchDocumentsInCollections,
  type ToolCallLog
} from "@/lib/xai";
import {
  resolveDefaultXchatPersonaForSession,
  retrieveRagChunks,
  saveXChatLog
} from "@/modules/xchat/repository";
import { normalizePersonaXapiConfig } from "@/modules/xchat/types";
import {
  createXfinanceToolExecutor,
  ATXFINANCE_TOOL_DEFINITION
} from "@/modules/xchat/tool-executor";
import { verifyXaiCollectionNonBlocking } from "@/modules/xchat/xai-collection-verifier";

const askSchema = z.object({
  message: z.string().min(2).max(8_000),
  /** @deprecated Ignored — persona is chosen from session role (xFinance vs Super-Agent). */
  personaId: z.string().optional(),
  scope: z.string().min(1).max(128).optional(),
  topK: z.number().int().min(1).max(10).optional()
});

const MAX_ASK_PAYLOAD_BYTES = 24 * 1024;
const ASK_RATE_WINDOW_MS = 60_000;
const ASK_RATE_MAX = 20;

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
  void parsed.data.personaId;

  const persona = await resolveDefaultXchatPersonaForSession(session.roles);
  if (!persona) {
    return NextResponse.json(
      {
        error:
          "Default admin xChat persona (Super-Agent) is missing. Run npm run seed:admin or create it in Admin → Personas."
      },
      { status: 503 }
    );
  }
  const xapiConfig = normalizePersonaXapiConfig(persona?.xapi);
  const scope = parsed.data.scope ?? persona?.defaultScope ?? "global";
  const tenantId = ObjectId.isValid(session.tenantId)
    ? new ObjectId(session.tenantId)
    : null;
  const userId = ObjectId.isValid(session.userId)
    ? new ObjectId(session.userId)
    : undefined;
  const collectionId = persona?.xaiCollection?.collectionId?.trim();
  if (collectionId) {
    verifyXaiCollectionNonBlocking(collectionId);
  }

  let contextSource: "none" | "mongo_scope" | "xai_collection" = "none";
  let ragChunks: Awaited<ReturnType<typeof retrieveRagChunks>> = [];
  let collectionContextReferences: Array<{
    documentId?: string;
    documentName?: string;
    snippetFingerprint: string;
  }> = [];
  let ragContext = "";
  let contextCount = 0;

  if (persona?.enableRag !== false) {
    if (collectionId) {
      try {
        const collectionSnippets = await searchDocumentsInCollections({
          query: message,
          collectionIds: [collectionId],
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
          `[xchat/ask] xAI collection search failed for ${collectionId}:`,
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

  const systemPrompt = [
    persona?.systemPrompt ?? "You are xchat, an operations-focused assistant for atxfinance core admins.",
    ragContext ? `Use the following RAG context if relevant:\n${ragContext}` : "No RAG context available."
  ].join("\n\n");
  const userPromptTemplate = persona?.overridePrompt?.trim() ?? "";
  const userPrompt = userPromptTemplate
    ? `${userPromptTemplate}\n\nUser message:\n${message}`
    : message;

  const hasXfinanceTool = xapiConfig.tools.some((t) => t.type === "atxfinance");
  let xaiResponse: { outputText: string; model: string };
  let toolCallLogs: ToolCallLog[] = [];

  try {
    if (xapiConfig.mode === "chat_completions") {
      xaiResponse = await chatWithXai({
        model: persona?.model,
        temperature: persona?.temperature ?? 0.2,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt }
        ],
        tools: xapiConfig.tools,
        toolChoice: xapiConfig.toolChoice
      });
    } else if (hasXfinanceTool) {
      const xaiTools: Array<Record<string, unknown>> = xapiConfig.tools
        .filter((t) => t.type !== "atxfinance")
        .map((t) => ({ ...t }));
      xaiTools.push(ATXFINANCE_TOOL_DEFINITION);

      const executor = createXfinanceToolExecutor({
        userId: session.userId,
        tenantId: session.tenantId
      });
      const loopResult = await respondWithXaiToolLoop({
        model: persona?.model,
        systemPrompt,
        userPrompt,
        tools: xaiTools,
        toolChoice: xapiConfig.toolChoice,
        maxTurns: xapiConfig.maxTurns,
        executor
      });
      xaiResponse = { outputText: loopResult.outputText, model: loopResult.model };
      toolCallLogs = loopResult.toolCalls;
    } else {
      xaiResponse = await respondWithXai({
        model: persona?.model,
        systemPrompt,
        userPrompt,
        tools: xapiConfig.tools,
        toolChoice: xapiConfig.toolChoice,
        maxTurns: xapiConfig.maxTurns
      });
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
    model: persona?.model,
    responseLength: xaiResponse.outputText.length,
    mode: xapiConfig.mode
  });
  logXchatAskFullPayload({
    userId: session.userId,
    personaName: persona?.name,
    systemPrompt,
    userPrompt,
    ragContext,
    tools: xapiConfig.tools.map((t) => t.type),
    model: persona?.model,
    responseText: xaiResponse.outputText
  });

  await saveXChatLog({
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
          durationMs: tc.durationMs,
          error: tc.error
        }))
      : undefined
  });

  return NextResponse.json({
    data: {
      response: xaiResponse.outputText,
      model: xaiResponse.model,
      personaName: persona.name,
      contextCount,
      contextSource,
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
