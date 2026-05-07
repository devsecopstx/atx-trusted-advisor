import { describe, expect, it } from "vitest";

import {
    createPostAskSseReadableStream,
    formatSseMessage,
    resolveStreamChunkConfig
} from "@/modules/xchat/xchat-ask-stream-sse";

async function readAll(stream: ReadableStream<Uint8Array>): Promise<string> {
  const reader = stream.getReader();
  const dec = new TextDecoder();
  let out = "";
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    out += dec.decode(value, { stream: true });
  }
  out += dec.decode();
  return out;
}

describe("xchat-ask-stream-sse", () => {
  it("formatSseMessage emits one event block", () => {
    expect(formatSseMessage("meta", { v: 1 })).toBe('event: meta\ndata: {"v":1}\n\n');
  });

  it("streams meta, deltas, done and omits large fields from done", async () => {
    const stream = createPostAskSseReadableStream({
      content: "abcd",
      donePayload: { model: "m", logId: "x" },
      meta: {
        v: 1,
        phase: "post_tool_loop",
        threadId: "t",
        model: "m",
        personaId: "p"
      },
      chunkChars: 2,
      chunkDelayMs: 0
    });
    const text = await readAll(stream);
    expect(text).toContain("event: meta");
    expect(text).toContain("event: delta");
    expect(text).toMatch(/"c":"ab"/);
    expect(text).toMatch(/"c":"cd"/);
    expect(text).toContain("event: done");
    expect(text).toContain('"logId":"x"');
    expect(text).not.toContain('"content"');
  });

  it("does not split a UTF-16 surrogate pair when chunking", async () => {
    const grinning = "\uD83D\uDE00";
    const stream = createPostAskSseReadableStream({
      content: `a${grinning}b`,
      donePayload: {},
      meta: {
        v: 1,
        phase: "post_tool_loop",
        threadId: "",
        model: "",
        personaId: ""
      },
      chunkChars: 2,
      chunkDelayMs: 0
    });
    const text = await readAll(stream);
    expect(text).toContain(grinning);
    const deltas = [...text.matchAll(/event: delta\ndata: (\{[^}]+\})/g)].map((m) => m[1]);
    const joined = deltas.map((d) => JSON.parse(d).c as string).join("");
    expect(joined).toBe(`a${grinning}b`);
  });

  it("resolveStreamChunkConfig clamps values", () => {
    const prevC = process.env.XCHAT_STREAM_CHUNK_CHARS;
    const prevD = process.env.XCHAT_STREAM_CHUNK_DELAY_MS;
    process.env.XCHAT_STREAM_CHUNK_CHARS = "10000";
    process.env.XCHAT_STREAM_CHUNK_DELAY_MS = "999999";
    const hi = resolveStreamChunkConfig();
    expect(hi.chunkChars).toBe(4096);
    expect(hi.chunkDelayMs).toBe(5000);
    process.env.XCHAT_STREAM_CHUNK_CHARS = "4";
    process.env.XCHAT_STREAM_CHUNK_DELAY_MS = "";
    const lo = resolveStreamChunkConfig();
    expect(lo.chunkChars).toBe(8);
    expect(lo.chunkDelayMs).toBe(0);
    if (prevC === undefined) delete process.env.XCHAT_STREAM_CHUNK_CHARS;
    else process.env.XCHAT_STREAM_CHUNK_CHARS = prevC;
    if (prevD === undefined) delete process.env.XCHAT_STREAM_CHUNK_DELAY_MS;
    else process.env.XCHAT_STREAM_CHUNK_DELAY_MS = prevD;
  });
});
