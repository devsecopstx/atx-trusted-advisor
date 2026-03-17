import { ObjectId } from "mongodb";
import { NextResponse } from "next/server";
import { z } from "zod";

import { requireSessionUser } from "@/lib/auth";
import { checkRateLimit } from "@/lib/rate-limit";
import { chatWithXai, searchDocumentsInCollections } from "@/lib/xai";
import {
  getPersonaById,
  retrieveRagChunks,
  saveXChatLog
} from "@/modules/xchat/repository";
import { verifyXaiCollectionNonBlocking } from "@/modules/xchat/xai-collection-verifier";

const askSchema = z.object({
  message: z.string().min(2).max(8_000),
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

  const { message, personaId, topK = 4 } = parsed.data;
  const persona = personaId ? await getPersonaById(personaId) : null;
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
      ragChunks = await retrieveRagChunks(tenantId, scope, message, topK);
      if (ragChunks.length > 0) {
        contextSource = "mongo_scope";
      }
      contextCount = ragChunks.length;
      ragContext = ragChunks
        .map((chunk, index) => `[#${index + 1}] ${chunk.text}`)
        .join("\n\n");
    }
  }

  const systemPrompt = [
    persona?.systemPrompt ?? "You are xchat, an operations-focused assistant for xfinance core admins.",
    ragContext ? `Use the following RAG context if relevant:\n${ragContext}` : "No RAG context available."
  ].join("\n\n");
  const userPromptTemplate = persona?.overridePrompt?.trim() ?? "";
  const userPrompt = userPromptTemplate
    ? `${userPromptTemplate}\n\nUser message:\n${message}`
    : message;

  const xaiResponse = await chatWithXai({
    model: persona?.model,
    temperature: persona?.temperature ?? 0.2,
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt }
    ]
  });

  const contextChunkIds = ragChunks.flatMap((chunk) => (chunk._id ? [chunk._id] : []));
  await saveXChatLog({
    userId,
    tenantId: tenantId ?? undefined,
    userEmail: session.email,
    requestedBy: session.username,
    personaId: persona?._id,
    message,
    response: xaiResponse.outputText,
    contextChunkIds,
    model: xaiResponse.model
  });

  return NextResponse.json({
    data: {
      response: xaiResponse.outputText,
      model: xaiResponse.model,
      contextCount,
      contextSource
    }
  });
}
