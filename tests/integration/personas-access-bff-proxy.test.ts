import { beforeEach, describe, expect, it, vi } from "vitest";

const bffMocks = vi.hoisted(() => ({
  proxyRequestToBackend: vi.fn<(request: Request) => Promise<Response | null>>()
}));

vi.mock("@/lib/backend-bff", () => ({
  proxyRequestToBackend: bffMocks.proxyRequestToBackend
}));

import { POST as postAccessRequest } from "@/app/api/access-requests/route";
import { GET as getPersonas, POST as postPersona } from "@/app/api/personas/route";

describe("personas + access-requests BFF proxy", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    bffMocks.proxyRequestToBackend.mockResolvedValue(null);
  });

  it("POST /api/access-requests returns backend response when proxy resolves non-null", async () => {
    const proxied = new Response(JSON.stringify({ ok: true, data: { status: "pending" } }), {
      status: 201,
      headers: { "Content-Type": "application/json" }
    });
    bffMocks.proxyRequestToBackend.mockResolvedValueOnce(proxied);

    const req = new Request("http://test/api/access-requests", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reason: "Please grant access for testing the BFF path." })
    });
    const response = await postAccessRequest(req);

    expect(response.status).toBe(201);
    expect(bffMocks.proxyRequestToBackend).toHaveBeenCalledWith(req);
  });

  it("GET /api/personas returns backend response when proxy resolves non-null", async () => {
    const proxied = new Response(JSON.stringify({ data: [] }), {
      status: 200,
      headers: { "Content-Type": "application/json" }
    });
    bffMocks.proxyRequestToBackend.mockResolvedValueOnce(proxied);

    const req = new Request("http://test/api/personas");
    const response = await getPersonas(req);

    expect(response.status).toBe(200);
    expect(bffMocks.proxyRequestToBackend).toHaveBeenCalledWith(req);
  });

  it("POST /api/personas returns backend response when proxy resolves non-null", async () => {
    const proxied = new Response(JSON.stringify({ data: { _id: "abc", name: "P" } }), {
      status: 201,
      headers: { "Content-Type": "application/json" }
    });
    bffMocks.proxyRequestToBackend.mockResolvedValueOnce(proxied);

    const req = new Request("http://test/api/personas", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "x", systemPrompt: "1234567890" })
    });
    const response = await postPersona(req);

    expect(response.status).toBe(201);
    expect(bffMocks.proxyRequestToBackend).toHaveBeenCalledWith(req);
  });
});
