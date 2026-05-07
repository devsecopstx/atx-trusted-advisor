export type XchatAskStreamMetaEvent = {
  v: 1;
  phase: "post_tool_loop";
  threadId: string;
  model: string;
  personaId: string;
  durationMs?: number;
  sourcesUsed?: number;
};

export function formatSseMessage(event: string, data: unknown): string {
  return `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
}

/** Slice by UTF-16 code units without splitting a surrogate pair at the boundary. */
function* chunkUtf16PreservingPairs(str: string, maxUnits: number): Generator<string> {
  if (maxUnits <= 0) {
    yield str;
    return;
  }
  let i = 0;
  while (i < str.length) {
    let sliceEnd = Math.min(i + maxUnits, str.length);
    while (
      sliceEnd > i &&
      isHighSurrogate(str.charCodeAt(sliceEnd - 1)) &&
      sliceEnd < str.length &&
      isLowSurrogate(str.charCodeAt(sliceEnd))
    ) {
      sliceEnd -= 1;
    }
    if (sliceEnd === i) {
      if (
        i + 1 < str.length &&
        isHighSurrogate(str.charCodeAt(i)) &&
        isLowSurrogate(str.charCodeAt(i + 1))
      ) {
        sliceEnd = i + 2;
      } else {
        sliceEnd = i + 1;
      }
    }
    yield str.slice(i, sliceEnd);
    i = sliceEnd;
  }
}

function isHighSurrogate(code: number): boolean {
  return code >= 0xd800 && code <= 0xdbff;
}

function isLowSurrogate(code: number): boolean {
  return code >= 0xdc00 && code <= 0xdfff;
}

export function createPostAskSseReadableStream(input: {
  content: string;
  donePayload: Record<string, unknown>;
  meta: XchatAskStreamMetaEvent;
  chunkChars: number;
  chunkDelayMs: number;
}): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  const { content, donePayload, meta, chunkChars, chunkDelayMs } = input;

  return new ReadableStream({
    async start(controller) {
      const push = (s: string) => controller.enqueue(encoder.encode(s));
      try {
        push(formatSseMessage("meta", meta));
        for (const chunk of chunkUtf16PreservingPairs(content, chunkChars)) {
          push(formatSseMessage("delta", { c: chunk }));
          if (chunkDelayMs > 0) {
            await new Promise((r) => setTimeout(r, chunkDelayMs));
          }
        }
        push(formatSseMessage("done", donePayload));
      } catch (e) {
        const message = e instanceof Error ? e.message : String(e);
        push(formatSseMessage("error", { message }));
      } finally {
        controller.close();
      }
    }
  });
}

export type XchatLiveSseEmit = {
  meta: (data: Record<string, unknown>) => void;
  delta: (data: { c: string }) => void;
  done: (data: Record<string, unknown>) => void;
  error: (data: { message: string; code?: string }) => void;
  ping: (data: { t: number }) => void;
  turn: (data: { index: number }) => void;
  provider: (data: Record<string, unknown>) => void;
  tool_status: (data: Record<string, unknown>) => void;
};

/**
 * Live SSE pipeline for xChat: **`run`** executes the tool loop (emitting deltas asynchronously); optional heartbeat **`ping`** events keep proxies from timing out.
 */
export function createXchatLiveSseReadableStream(input: {
  heartbeatMs?: number;
  run: (emit: XchatLiveSseEmit) => Promise<void>;
}): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  const heartbeatMs =
    typeof input.heartbeatMs === "number" && Number.isFinite(input.heartbeatMs)
      ? Math.max(5000, Math.min(120_000, Math.floor(input.heartbeatMs)))
      : 20_000;

  return new ReadableStream({
    async start(controller) {
      const push = (event: string, data: unknown) =>
        controller.enqueue(encoder.encode(formatSseMessage(event, data)));

      const emit: XchatLiveSseEmit = {
        meta: (d) => push("meta", d),
        delta: (d) => push("delta", d),
        done: (d) => push("done", d),
        error: (d) => push("error", d),
        ping: (d) => push("ping", d),
        turn: (d) => push("turn", d),
        provider: (d) => push("provider", d),
        tool_status: (d) => push("tool_status", d)
      };

      const hb =
        heartbeatMs > 0
          ? setInterval(() => {
              try {
                emit.ping({ t: Date.now() });
              } catch {
                /* stream closed */
              }
            }, heartbeatMs)
          : undefined;

      try {
        await input.run(emit);
      } catch (e) {
        const message = e instanceof Error ? e.message : String(e);
        emit.error({ message });
      } finally {
        if (hb) {
          clearInterval(hb);
        }
        controller.close();
      }
    }
  });
}

export function resolveStreamChunkConfig(): { chunkChars: number; chunkDelayMs: number } {
  const chunkCharsRaw = process.env.XCHAT_STREAM_CHUNK_CHARS;
  const chunkDelayRaw = process.env.XCHAT_STREAM_CHUNK_DELAY_MS;
  const parsedChars = Number(chunkCharsRaw);
  const parsedDelay = Number(chunkDelayRaw);
  const chunkChars = Number.isFinite(parsedChars)
    ? Math.max(8, Math.min(4096, Math.floor(parsedChars)))
    : 256;
  const chunkDelayMs = Number.isFinite(parsedDelay)
    ? Math.max(0, Math.min(5000, Math.floor(parsedDelay)))
    : 0;
  return { chunkChars, chunkDelayMs };
}
