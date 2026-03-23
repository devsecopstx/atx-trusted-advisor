import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createAtxfinanceBackendBff } from "@/lib/backend-bff";

describe("createAtxfinanceBackendBff", () => {
  const fetchMock = vi.fn<(input: RequestInfo | URL, init?: RequestInit) => Promise<Response>>();
  let origin: string | undefined;

  beforeEach(() => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ ok: true }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    origin = undefined;
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("returns null and does not fetch when origin is undefined", async () => {
    const bff = createAtxfinanceBackendBff(() => origin);
    const req = new Request("http://next.local/api/portfolios/p1?q=1");
    await expect(bff.proxyRequest(req)).resolves.toBeNull();
    expect(bff.getOrigin()).toBeUndefined();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("forwards GET path and query to origin with cookie and accept", async () => {
    origin = "http://127.0.0.1:8080";
    const bff = createAtxfinanceBackendBff(() => origin);
    const req = new Request("http://next.local/api/portfolios/p1?q=1", {
      headers: {
        cookie: "xf_core_session=abc",
        accept: "application/json"
      }
    });
    const res = await bff.proxyRequest(req);
    expect(res?.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(String(fetchMock.mock.calls[0]?.[0])).toBe("http://127.0.0.1:8080/api/portfolios/p1?q=1");
    const init = fetchMock.mock.calls[0]?.[1] as (RequestInit & { duplex?: string }) | undefined;
    expect(init?.method).toBe("GET");
    expect(init?.redirect).toBe("manual");
    expect(init?.body).toBeUndefined();
    expect(init?.duplex).toBeUndefined();
    const h = init?.headers as Headers;
    expect(h.get("cookie")).toBe("xf_core_session=abc");
    expect(h.get("accept")).toBe("application/json");
  });

  it("forwards POST body with duplex and content-type", async () => {
    origin = "http://127.0.0.1:8080";
    const bff = createAtxfinanceBackendBff(() => origin);
    const req = new Request("http://next.local/api/positions", {
      method: "POST",
      headers: { "content-type": "application/json", cookie: "a=b" },
      body: JSON.stringify({ x: 1 })
    });
    await bff.proxyRequest(req);
    const init = fetchMock.mock.calls[0]?.[1] as (RequestInit & { duplex?: string }) | undefined;
    expect(init?.method).toBe("POST");
    expect(init?.duplex).toBe("half");
    expect(init?.body).toBe(req.body);
    const h = init?.headers as Headers;
    expect(h.get("content-type")).toBe("application/json");
  });

  it("does not forward content-type when absent on GET", async () => {
    origin = "http://127.0.0.1:8080";
    const bff = createAtxfinanceBackendBff(() => origin);
    await bff.proxyRequest(new Request("http://next.local/api/health"));
    const init = fetchMock.mock.calls[0]?.[1] as RequestInit | undefined;
    const h = init?.headers as Headers;
    expect(h.has("content-type")).toBe(false);
  });
});

describe("proxyRequestToBackend (default BFF, env)", () => {
  const fetchMock = vi.fn<(input: RequestInfo | URL, init?: RequestInit) => Promise<Response>>();

  beforeEach(() => {
    fetchMock.mockResolvedValue(new Response("{}", { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    delete process.env.ATXFINANCE_BACKEND_ORIGIN;
  });

  afterEach(() => {
    delete process.env.ATXFINANCE_BACKEND_ORIGIN;
    vi.unstubAllGlobals();
  });

  it("uses ATXFINANCE_BACKEND_ORIGIN when set", async () => {
    process.env.ATXFINANCE_BACKEND_ORIGIN = "http://127.0.0.1:8080";
    vi.resetModules();
    const { proxyRequestToBackend } = await import("@/lib/backend-bff");
    await proxyRequestToBackend(new Request("http://next/api/health"));
    expect(String(fetchMock.mock.calls[0]?.[0])).toBe("http://127.0.0.1:8080/api/health");
  });

  it("returns null when ATXFINANCE_BACKEND_ORIGIN is unset", async () => {
    vi.resetModules();
    const { proxyRequestToBackend } = await import("@/lib/backend-bff");
    await expect(proxyRequestToBackend(new Request("http://next/api/health"))).resolves.toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
