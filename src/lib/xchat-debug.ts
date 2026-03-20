/**
 * xChat debug logging — enabled via ENABLE_XCHAT_DEBUG=true.
 * Emits structured payloads for RAG/expert learning. Configure Cloud Logging
 * retention (e.g. 30 days) at project or log-bucket level.
 */
import { isXchatDebugEnabled } from "@/lib/env";

const LOG_PREFIX = "[xchat/debug]";

function maskUserId(id: string | undefined): string {
  if (!id) return "?";
  if (id.length <= 8) return "***";
  return `${id.slice(0, 4)}...${id.slice(-4)}`;
}

function maskEmail(email: string | undefined): string {
  if (!email) return "?";
  const [local, domain] = email.split("@");
  if (!domain) return "***";
  const masked = local.length <= 2 ? "***" : `${local.slice(0, 2)}***`;
  return `${masked}@${domain}`;
}

export function logXchatAskDebug(payload: {
  userId?: string;
  email?: string;
  personaId?: string;
  personaName?: string;
  message: string;
  systemPrompt: string;
  userPrompt: string;
  ragContextLength: number;
  contextSource: "none" | "mongo_scope" | "xai_collection";
  contextCount: number;
  tools: string[];
  model?: string;
  responseLength?: number;
  mode?: string;
}): void {
  if (!isXchatDebugEnabled()) return;

  const safe = {
    ts: new Date().toISOString(),
    type: "xchat_ask",
    userId: maskUserId(payload.userId),
    email: maskEmail(payload.email),
    personaId: payload.personaId,
    personaName: payload.personaName,
    messageLength: payload.message.length,
    messagePreview: payload.message.slice(0, 200) + (payload.message.length > 200 ? "…" : ""),
    systemPromptLength: payload.systemPrompt.length,
    systemPromptPreview: payload.systemPrompt.slice(0, 500) + (payload.systemPrompt.length > 500 ? "…" : ""),
    userPromptLength: payload.userPrompt.length,
    userPromptPreview: payload.userPrompt.slice(0, 300) + (payload.userPrompt.length > 300 ? "…" : ""),
    ragContextLength: payload.ragContextLength,
    contextSource: payload.contextSource,
    contextCount: payload.contextCount,
    tools: payload.tools,
    model: payload.model,
    responseLength: payload.responseLength,
    mode: payload.mode
  };

  console.info(LOG_PREFIX, JSON.stringify(safe));
}

export function logXchatAskFullPayload(payload: {
  userId?: string;
  personaName?: string;
  systemPrompt: string;
  userPrompt: string;
  ragContext: string;
  tools: string[];
  model?: string;
  responseText?: string;
}): void {
  if (!isXchatDebugEnabled()) return;

  const safe = {
    ts: new Date().toISOString(),
    type: "xchat_ask_full",
    userId: maskUserId(payload.userId),
    personaName: payload.personaName,
    systemPrompt: payload.systemPrompt,
    userPrompt: payload.userPrompt,
    ragContext: payload.ragContext,
    tools: payload.tools,
    model: payload.model,
    responseText: payload.responseText
  };

  console.info(LOG_PREFIX, JSON.stringify(safe));
}

export function logXchatBatchDebug(payload: {
  batchId?: string;
  personaId?: string;
  personaName?: string;
  itemCount: number;
  itemId?: string;
  messagePreview?: string;
  systemPromptLength?: number;
  userPromptLength?: number;
  ragContextLength?: number;
  tools?: string[];
}): void {
  if (!isXchatDebugEnabled()) return;

  const safe = {
    ts: new Date().toISOString(),
    type: "xchat_batch",
    batchId: payload.batchId,
    personaId: payload.personaId,
    personaName: payload.personaName,
    itemCount: payload.itemCount,
    itemId: payload.itemId,
    messagePreview: payload.messagePreview,
    systemPromptLength: payload.systemPromptLength,
    userPromptLength: payload.userPromptLength,
    ragContextLength: payload.ragContextLength,
    tools: payload.tools
  };

  console.info(LOG_PREFIX, JSON.stringify(safe));
}
