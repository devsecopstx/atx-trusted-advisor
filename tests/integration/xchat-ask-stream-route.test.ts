import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const bffMocks = vi.hoisted(() => ({
  proxyPortfolioRequestToBackend: vi.fn(),
  releaseUnusedProxyResponse: vi.fn()
}));

vi.mock("@/lib/backend-bff", () => bffMocks);

import { POST as postAskStream } from "@/app/api/xchat/ask/stream/route";

async function readAll(stream: ReadableStream<Uint8Array> | null): Promise<string> {
  if (!stream) return "";
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

describe("POST /api/xchat/ask/stream", () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    bffMocks.proxyPortfolioRequestToBackend.mockResolvedValue(null);
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.clearAllMocks();
  });

  it("proxies live SSE when delegate returns text/event-stream", async () => {
    const ssePayload =
      `event: meta\ndata: {"v":1,"phase":"live_tool_loop"}\n\n` +
      `event: delta\ndata: {"c":"Hi"}\n\n` +
      `event: done\ndata: {"model":"grok-test","interactionMeta":{"generationMs":1,"sources":{"ragChunks":0,"toolInvocations":0,"personaCollections":0,"total":0}}}\n\n`;
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(ssePayload, {
        status: 200,
        headers: {
          "content-type": "text/event-stream",
          "x-xchat-limit-remaining-minute": "9"
        }
      })
    );
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    const req = new Request("http://localhost:3000/api/xchat/ask/stream", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        cookie: "xf_core_session=test"
      },
      body: JSON.stringify({ message: "hi" })
    });

    const res = await postAskStream(req);
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("text/event-stream");
    expect(res.headers.get("x-xchat-limit-remaining-minute")).toBe("9");

    const body = await readAll(res.body);
    expect(body).toContain("event: meta");
    expect(body).toContain("live_tool_loop");
    expect(body).toContain("event: delta");
    expect(body).toContain('"c":"Hi"');
    expect(body).toContain("event: done");

    expect(fetchMock).toHaveBeenCalledWith(
      "http://localhost:3000/api/xchat/ask",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ message: "hi" }),
        headers: expect.objectContaining({
          cookie: "xf_core_session=test",
          "content-type": "application/json",
          accept: "text/event-stream"
        })
      })
    );
  });

  it("returns JSON when delegate returns an error body", async () => {
    globalThis.fetch = vi
      .fn()
      .mockResolvedValue(
        new Response(JSON.stringify({ error: "Subscription required", code: "billing_subscription_required" }), {
          status: 402,
          headers: { "content-type": "application/json" }
        })
      ) as unknown as typeof fetch;

    const req = new Request("http://localhost:3000/api/xchat/ask/stream", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ message: "hi" })
    });

    const res = await postAskStream(req);
    expect(res.status).toBe(402);
    const json = (await res.json()) as { code?: string };
    expect(json.code).toBe("billing_subscription_required");
  });
});
