import { describe, expect, it } from "vitest";

import { parseJson } from "@/app/admin/ui/http";

describe("parseJson (admin http)", () => {
  it("parses successful JSON", async () => {
    const res = new Response(JSON.stringify({ data: [1] }), { status: 200 });
    const out = await parseJson<{ data: number[] }>(res);
    expect(out.data).toEqual([1]);
  });

  it("throws a friendly message for plain-text 429 (WAF / upstream)", async () => {
    const res = new Response("Rate exceeded.", { status: 429 });
    await expect(parseJson(res)).rejects.toThrow(/Too many requests/i);
  });

  it("uses JSON error fields on 429 when body is JSON", async () => {
    const res = new Response(JSON.stringify({ error: "rate_limited", code: "RL" }), {
      status: 429
    });
    await expect(parseJson(res)).rejects.toThrow(/rate_limited.*\[RL\]/);
  });

  it("formats non-429 JSON errors with details", async () => {
    const res = new Response(
      JSON.stringify({
        error: "Invalid request payload",
        details: { formErrors: ["bad"] }
      }),
      { status: 400 }
    );
    await expect(parseJson(res)).rejects.toThrow(/Invalid request payload.*bad/);
  });

  it("surfaces plain-text non-JSON error bodies", async () => {
    const res = new Response("upstream offline", { status: 502 });
    await expect(parseJson(res)).rejects.toThrow("upstream offline");
  });
});
