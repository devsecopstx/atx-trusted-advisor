import { getEnv, XAI_BASE_URL_DEFAULT } from "@/lib/env";
import type { XaiVoiceRealtimeModelId } from "@/modules/xchat/voice/types";

export type XaiRealtimeClientSecret = {
  value: string;
  expires_at: number;
};

function httpApiBase(): string {
  const env = getEnv();
  return (env.XAI_BASE_URL ?? XAI_BASE_URL_DEFAULT).replace(/\/?$/, "");
}

/**
 * Browser WebSocket URL for Voice Agent (`wss://…/v1/realtime?model=…`).
 */
export function buildXaiRealtimeWsUrl(model: XaiVoiceRealtimeModelId): string {
  const base = httpApiBase();
  const u = new URL(base);
  u.protocol = u.protocol === "https:" ? "wss:" : "ws:";
  const path = u.pathname.replace(/\/?$/, "");
  u.pathname = `${path}/realtime`;
  u.search = new URLSearchParams({ model }).toString();
  return u.toString();
}

/**
 * Server-only: mint ephemeral client secret for browser/mobile realtime connections.
 */
export async function createXaiRealtimeClientSecret(input: {
  expiresSeconds: number;
  model: XaiVoiceRealtimeModelId;
}): Promise<XaiRealtimeClientSecret> {
  const apiKey = getEnv().XAI_API_KEY?.trim();
  if (!apiKey) {
    throw new Error("missing_xai_api_key");
  }
  const seconds = Math.min(3600, Math.max(60, Math.floor(input.expiresSeconds)));
  const url = `${httpApiBase()}/realtime/client_secrets`;
  const response = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      expires_after: { seconds },
      session: { model: input.model }
    })
  });

  const rawText = await response.text();
  let raw: Record<string, unknown>;
  try {
    raw = rawText.trim() ? (JSON.parse(rawText) as Record<string, unknown>) : {};
  } catch {
    throw new Error(`xai_realtime_client_secret_invalid_json:${response.status}`);
  }

  if (!response.ok) {
    const errMsg =
      typeof raw.error === "string"
        ? raw.error
        : typeof raw.message === "string"
          ? raw.message
          : `http_${response.status}`;
    throw new Error(`xai_realtime_client_secret:${errMsg}`);
  }

  const value = typeof raw.value === "string" ? raw.value : "";
  const expiresAt = typeof raw.expires_at === "number" ? raw.expires_at : 0;
  if (!value || !expiresAt) {
    throw new Error("xai_realtime_client_secret:missing_fields");
  }

  return { value, expires_at: expiresAt };
}
