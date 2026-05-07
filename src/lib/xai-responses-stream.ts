/**
 * xAI `POST /v1/responses` with `stream: true` — SSE parsing for token deltas and terminal payload recovery.
 * Vendor shapes evolve; we accept chat-style chunks, Responses-style `type` events, and fall back to non-streaming.
 */

export type XaiResponsesStreamResult = {
  /** Best-effort merged assistant text from deltas (for UI only; tool loop uses `payload`). */
  deltaText: string;
  /** Parsed JSON body suitable for `extractToolCalls` / `extractResponseOutputText` when complete. */
  payload: Record<string, unknown>;
  /** xAI / Grok conversation id when upstream sends it. */
  grokConvId?: string;
};

function appendDelta(out: { deltaText: string }, chunk: string): void {
  if (!chunk) {
    return;
  }
  out.deltaText += chunk;
}

/** Extract assistant text delta from one streamed JSON object (multiple vendor shapes). */
export function extractTextDeltaFromStreamObject(obj: Record<string, unknown>): string | null {
  const typeField = typeof obj.type === "string" ? obj.type : "";

  if (typeField === "response.output_text.delta") {
    const d = obj.delta;
    if (typeof d === "string" && d.length > 0) {
      return d;
    }
    if (d && typeof d === "object" && !Array.isArray(d)) {
      const t = (d as Record<string, unknown>).text;
      if (typeof t === "string" && t.length > 0) {
        return t;
      }
    }
  }

  if (typeField.endsWith(".delta") && typeof obj.delta === "string") {
    return obj.delta;
  }

  const choices = obj.choices;
  if (Array.isArray(choices) && choices.length > 0) {
    const ch0 = choices[0];
    if (ch0 && typeof ch0 === "object" && !Array.isArray(ch0)) {
      const delta = (ch0 as Record<string, unknown>).delta;
      if (delta && typeof delta === "object" && !Array.isArray(delta)) {
        const content = (delta as Record<string, unknown>).content;
        if (typeof content === "string" && content.length > 0) {
          return content;
        }
      }
    }
  }

  if (typeof obj.text === "string" && obj.text.length > 0) {
    return obj.text;
  }

  const ot = obj.output_text;
  if (typeof ot === "string" && ot.length > 0) {
    return ot;
  }

  return null;
}

/** Best-effort tool / function-call lifecycle marker from a streamed JSON object (vendor shapes vary). */
export function summarizeToolLikeStreamEvent(
  obj: Record<string, unknown>
): Record<string, unknown> | null {
  const typeField = typeof obj.type === "string" ? obj.type : "";
  if (
    !typeField.includes("function_call") &&
    !typeField.includes("tool_call") &&
    !typeField.includes("response.output_item") &&
    typeField !== "response.tool_call"
  ) {
    return null;
  }

  const item =
    obj.item && typeof obj.item === "object" && !Array.isArray(obj.item)
      ? (obj.item as Record<string, unknown>)
      : null;
  const nameRaw =
    typeof obj.name === "string"
      ? obj.name
      : typeof obj.tool_name === "string"
        ? obj.tool_name
        : item && typeof item.name === "string"
          ? item.name
          : undefined;

  return {
    phase: "upstream",
    streamType: typeField,
    ...(nameRaw ? { name: nameRaw } : {})
  };
}

/** Prefer the richest terminal object for tool-call extraction. */
export function pickTerminalPayloadFromStreamObjects(
  objects: Record<string, unknown>[]
): Record<string, unknown> | null {
  let best: Record<string, unknown> | null = null;
  let bestScore = -1;
  for (const o of objects) {
    const output = o.output;
    const score =
      (Array.isArray(output) ? output.length : 0) +
      (typeof o.id === "string" ? 10 : 0) +
      (o.response && typeof o.response === "object" ? 50 : 0);
    if (score > bestScore) {
      bestScore = score;
      best = o;
    }
    const nested = o.response;
    if (nested && typeof nested === "object" && !Array.isArray(nested)) {
      const r = nested as Record<string, unknown>;
      const ro = r.output;
      const rScore =
        (Array.isArray(ro) ? ro.length : 0) + (typeof r.id === "string" ? 10 : 0) + 40;
      if (rScore > bestScore) {
        bestScore = rScore;
        best = r;
      }
    }
  }
  return best;
}

/**
 * Read SSE from a streaming `fetch` Response; invoke `onTextDelta` for partial assistant text.
 * Returns merged terminal payload; if unusable, caller should retry non-streaming.
 */
export async function consumeXaiResponsesSse(
  response: Response,
  onTextDelta: (chunk: string) => void,
  onStructuredEvent?: (obj: Record<string, unknown>) => void
): Promise<XaiResponsesStreamResult> {
  const out: XaiResponsesStreamResult = {
    deltaText: "",
    payload: {},
    grokConvId: response.headers.get("x-grok-conv-id") ?? undefined
  };

  const body = response.body;
  if (!body) {
    return out;
  }

  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  const parsedObjects: Record<string, unknown>[] = [];

  const handleDataLine = (raw: string): void => {
    const line = raw.trim();
    if (!line || line === "[DONE]") {
      return;
    }
    let obj: Record<string, unknown>;
    try {
      obj = JSON.parse(line) as Record<string, unknown>;
    } catch {
      return;
    }
    parsedObjects.push(obj);
    onStructuredEvent?.(obj);
    const d = extractTextDeltaFromStreamObject(obj);
    if (d) {
      appendDelta(out, d);
      onTextDelta(d);
    }
  };

  const processEventBlock = (block: string): void => {
    const lines = block.split("\n");
    const dataLines: string[] = [];
    for (const line of lines) {
      if (line.startsWith("data:")) {
        dataLines.push(line.slice(5).trimStart());
      }
    }
    if (dataLines.length === 0) {
      return;
    }
    handleDataLine(dataLines.join("\n"));
  };

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) {
        break;
      }
      buffer += decoder.decode(value, { stream: true });
      const parts = buffer.split("\n\n");
      buffer = parts.pop() ?? "";
      for (const block of parts) {
        if (block.trim()) {
          processEventBlock(block);
        }
      }
    }
    if (buffer.trim()) {
      processEventBlock(buffer);
    }
  } finally {
    reader.releaseLock();
  }

  const terminal = pickTerminalPayloadFromStreamObjects(parsedObjects);
  if (terminal && typeof terminal === "object") {
    out.payload = terminal;
  }

  return out;
}
