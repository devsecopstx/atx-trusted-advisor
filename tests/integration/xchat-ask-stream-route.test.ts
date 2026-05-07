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

  it("delegates to /api/xchat/ask and returns SSE on success", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          data: {
            content: "Hello",
            response: "Hello",
            model: "grok-test",
            metadata: {
              threadId: "t1",
              model: "grok-test",
              personaId: "p1",
              durationMs: 12,
              sourcesUsed: 1
            },
            interactionMeta: {
              generationMs: 12,
              sources: {
                ragChunks: 0,
                toolInvocations: 0,
                personaCollections: 1,
                total: 1
              }
            }
          }
        }),
        {
          status: 200,
          headers: { "x-xchat-limit-remaining-minute": "9" }
        }
      )
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
    expect(body).toContain('"phase":"post_tool_loop"');
    expect(body).toContain("event: delta");
    expect(body).toContain('"c":"Hello"');
    expect(body).toContain("event: done");
    expect(body).toContain('"model":"grok-test"');
    expect(body).not.toContain('"content"');

    expect(fetchMock).toHaveBeenCalledWith(
      "http://localhost:3000/api/xchat/ask",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ message: "hi" }),
        headers: expect.objectContaining({
          cookie: "xf_core_session=test",
          "content-type": "application/json"
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
