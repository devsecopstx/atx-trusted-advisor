import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const bffMocks = vi.hoisted(() => ({
  proxyPortfolioRequestToBackend: vi.fn(),
  releaseUnusedProxyResponse: vi.fn()
}));

const askMocks = vi.hoisted(() => ({
  postAsk: vi.fn()
}));

vi.mock("@/lib/backend-bff", () => bffMocks);
vi.mock("@/app/api/xchat/ask/route", () => ({
  POST: askMocks.postAsk
}));

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
  beforeEach(() => {
    bffMocks.proxyPortfolioRequestToBackend.mockResolvedValue(null);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("proxies live SSE when delegate returns text/event-stream", async () => {
    const ssePayload =
      `event: meta\ndata: {"v":1,"phase":"live_tool_loop"}\n\n` +
      `event: delta\ndata: {"c":"Hi"}\n\n` +
      `event: done\ndata: {"model":"grok-test","interactionMeta":{"generationMs":1,"sources":{"ragChunks":0,"toolInvocations":0,"personaCollections":0,"total":0}}}\n\n`;
    askMocks.postAsk.mockResolvedValue(
      new Response(ssePayload, {
        status: 200,
        headers: {
          "content-type": "text/event-stream",
          "x-xchat-limit-remaining-minute": "9"
        }
      })
    );

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

    expect(askMocks.postAsk).toHaveBeenCalledTimes(1);
    const delegatedRequest = askMocks.postAsk.mock.calls[0]?.[0] as Request;
    expect(delegatedRequest.url).toBe("http://localhost:3000/api/xchat/ask");
    expect(delegatedRequest.method).toBe("POST");
    expect(await delegatedRequest.text()).toBe(JSON.stringify({ message: "hi" }));
    expect(delegatedRequest.headers.get("cookie")).toBe("xf_core_session=test");
    expect(delegatedRequest.headers.get("content-type")).toBe("application/json");
    expect(delegatedRequest.headers.get("accept")).toBe("text/event-stream");
  });

  it("returns JSON when delegate returns an error body", async () => {
    askMocks.postAsk.mockResolvedValue(
      new Response(JSON.stringify({ error: "Subscription required", code: "billing_subscription_required" }), {
        status: 402,
        headers: { "content-type": "application/json" }
      })
    );

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
