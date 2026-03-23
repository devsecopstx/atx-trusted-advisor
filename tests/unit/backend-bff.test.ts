import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

describe("proxyRequestToBackend", () => {
  const fetchMock = vi.fn<(input: RequestInfo | URL, init?: RequestInit) => Promise<Response>>();

  beforeEach(() => {
    vi.stubEnv("ATXFINANCE_BACKEND_ORIGIN", "http://127.0.0.1:8080");
    vi.stubGlobal("fetch", fetchMock);
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ ok: true }), { status: 200 }));
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("returns null when ATXFINANCE_BACKEND_ORIGIN is unset", async () => {
    vi.stubEnv("ATXFINANCE_BACKEND_ORIGIN", "");
    const { proxyRequestToBackend } = await import("@/lib/backend-bff");
    const req = new Request("http://app.test/api/portfolios/default");
    const out = await proxyRequestToBackend(req);
    expect(out).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("forwards GET to backend origin with path and query", async () => {
    const { proxyRequestToBackend } = await import("@/lib/backend-bff");
    const req = new Request("http://app.test/api/positions?portfolioId=a&accountId=b", {
      headers: { cookie: "xf_core_session=abc", accept: "application/json" }
    });
    await proxyRequestToBackend(req);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] ?? [];
    expect(String(url)).toBe("http://127.0.0.1:8080/api/positions?portfolioId=a&accountId=b");
    expect(init?.method).toBe("GET");
    const h = new Headers(init?.headers as HeadersInit);
    expect(h.get("cookie")).toBe("xf_core_session=abc");
    expect(h.get("accept")).toBe("application/json");
    expect(init?.redirect).toBe("manual");
  });

  it("forwards POST body and Content-Type", async () => {
    const { proxyRequestToBackend } = await import("@/lib/backend-bff");
    const body = JSON.stringify({ portfolioId: "x", accountId: "y" });
    const req = new Request("http://app.test/api/positions", {
      method: "POST",
      headers: { "Content-Type": "application/json", cookie: "s=1" },
      body
    });
    await proxyRequestToBackend(req);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [, init] = fetchMock.mock.calls[0] ?? [];
    expect(init?.method).toBe("POST");
    expect((init as RequestInit & { duplex?: string })?.duplex).toBe("half");
    const h = new Headers(init?.headers as HeadersInit);
    expect(h.get("content-type")).toBe("application/json");
    expect(h.get("cookie")).toBe("s=1");
  });
});
