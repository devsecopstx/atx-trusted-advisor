import type { XchatLiveToolStatus } from "@/app/xchat/ui/xchat-conversation-types";

export type XchatSseHandler = {
  onMeta?: (data: Record<string, unknown>) => void;
  onDelta?: (chunk: string) => void;
  onTurn?: (data: { index: number }) => void;
  onProvider?: (data: Record<string, unknown>) => void;
  onToolStatus?: (data: Record<string, unknown>) => void;
  onPing?: (t: number) => void;
  onDone?: (data: Record<string, unknown>) => void;
  onError?: (data: { message: string; code?: string }) => void;
};

/**
 * Parse xChat SSE (`meta`, `delta`, `done`, …) from a streaming `fetch` response body.
 */
export async function consumeXchatAskSseResponse(
  response: Response,
  handlers: XchatSseHandler,
  options?: { signal?: AbortSignal }
): Promise<{ ok: boolean; donePayload?: Record<string, unknown> }> {
  const reader = response.body?.getReader();
  if (!reader) {
    return { ok: false };
  }
  const decoder = new TextDecoder();
  let buf = "";
  const signal = options?.signal;

  try {
    while (true) {
      if (signal?.aborted) {
        break;
      }
      const { done, value } = await reader.read();
      if (done) {
        break;
      }
      buf += decoder.decode(value, { stream: true });
      const blocks = buf.split("\n\n");
      buf = blocks.pop() ?? "";
      for (const block of blocks) {
        if (!block.trim()) {
          continue;
        }
        const lines = block.split("\n");
        let eventName = "";
        const dataParts: string[] = [];
        for (const line of lines) {
          if (line.startsWith("event:")) {
            eventName = line.slice(6).trim();
          } else if (line.startsWith("data:")) {
            dataParts.push(line.slice(5).trimStart());
          }
        }
        const dataRaw = dataParts.join("\n");
        if (!dataRaw) {
          continue;
        }
        let data: unknown;
        try {
          data = JSON.parse(dataRaw);
        } catch {
          continue;
        }
        const d = data as Record<string, unknown>;
        switch (eventName) {
          case "meta":
            handlers.onMeta?.(d);
            break;
          case "delta":
            if (typeof d.c === "string") {
              handlers.onDelta?.(d.c);
            }
            break;
          case "turn":
            if (typeof d.index === "number") {
              handlers.onTurn?.({ index: d.index });
            }
            break;
          case "provider":
            handlers.onProvider?.(d);
            break;
          case "tool_status":
            handlers.onToolStatus?.(d);
            break;
          case "ping":
            if (typeof d.t === "number") {
              handlers.onPing?.(d.t);
            }
            break;
          case "done":
            handlers.onDone?.(d);
            return { ok: true, donePayload: d };
          case "error": {
            const message =
              typeof d.message === "string" ? d.message : "xchat_stream_error";
            const code = typeof d.code === "string" ? d.code : undefined;
            handlers.onError?.({ message, ...(code ? { code } : {}) });
            return { ok: false };
          }
          default:
            break;
        }
      }
    }
  } finally {
    reader.releaseLock();
  }
  return { ok: false };
}

export function mergeLiveToolStatusRow(
  prev: XchatLiveToolStatus[],
  ev: Record<string, unknown>
): XchatLiveToolStatus[] {
  const name =
    typeof ev.name === "string"
      ? ev.name
      : Array.isArray(ev.tools) && ev.tools.length > 0 && typeof ev.tools[0] === "string"
        ? ev.tools[0]
        : "tool";
  const phase = typeof ev.phase === "string" ? ev.phase : "update";
  const detail =
    typeof ev.streamType === "string"
      ? ev.streamType
      : typeof ev.turnIndex === "number"
        ? `turn ${ev.turnIndex}`
        : undefined;
  const row: XchatLiveToolStatus = {
    name,
    phase,
    ...(detail ? { detail } : {})
  };
  const idx = prev.findIndex((p) => p.name === name && p.phase === phase);
  if (idx >= 0) {
    const next = [...prev];
    next[idx] = row;
    return next;
  }
  return [...prev, row];
}
