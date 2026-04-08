import { getEnv } from "@/lib/env";
import { XAI_PERSONA_CHAT_MODEL_FALLBACK_ID } from "@/modules/xchat/xai-persona-chat-models";

/** Server-only: default xPersona model id from `XAI_CHAT_MODEL` (same as xAI client default). */
export function getDefaultPersonaChatModelId(): string {
  const raw = getEnv().XAI_CHAT_MODEL?.trim();
  return raw && raw.length > 0 ? raw : XAI_PERSONA_CHAT_MODEL_FALLBACK_ID;
}
