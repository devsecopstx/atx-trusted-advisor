import { describe, expect, it } from "vitest";

import { readFetchJsonBody } from "@/lib/read-fetch-json-body";

describe("readFetchJsonBody", () => {
  it("parses JSON object bodies", async () => {
    const res = new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { "Content-Type": "application/json" }
    });
    const { json } = await readFetchJsonBody<{ ok: boolean }>(res);
    expect(json.ok).toBe(true);
  });

  it("throws a clear message for plain-text 429 (WAF / upstream)", async () => {
    const res = new Response("Rate exceeded.", { status: 429 });
    await expect(readFetchJsonBody(res)).rejects.toThrow(/Too many requests/i);
  });

  it("throws plain text for non-JSON error bodies", async () => {
    const res = new Response("bad gateway", { status: 502 });
    await expect(readFetchJsonBody(res)).rejects.toThrow("bad gateway");
  });

  it("parses JSON error payloads and lets caller branch on res.ok", async () => {
    const res = new Response(JSON.stringify({ error: "nope" }), { status: 403 });
    const { json } = await readFetchJsonBody<{ error?: string }>(res);
    expect(json.error).toBe("nope");
  });
});
