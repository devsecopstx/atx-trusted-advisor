import { NextRequest } from "next/server";
import { describe, expect, it, vi } from "vitest";

import { SESSION_COOKIE_NAME } from "@/lib/session-cookie-name";
import { proxy } from "@/proxy";

function request(path: string, cookieValue?: string) {
  const headers = new Headers();
  if (cookieValue !== undefined) {
    headers.set("cookie", `${SESSION_COOKIE_NAME}=${cookieValue}`);
  }
  return new NextRequest(new URL(`http://127.0.0.1:3000${path}`), { headers });
}

describe("proxy (middleware) guest HTML routes", () => {
  it("does not redirect unauthenticated /resources/top-10-hnwi-xchat-prompts (public article)", async () => {
    const res = await proxy(request("/resources/top-10-hnwi-xchat-prompts"));
    expect(res.headers.get("location")).toBeNull();
    expect(res.status).toBeLessThan(400);
  });

  it("does not redirect unauthenticated /xoptions (guest shell at URL)", async () => {
    const res = await proxy(request("/xoptions"));
    expect(res.headers.get("location")).toBeNull();
  });

  it("does not redirect unauthenticated /portfolio or /portfolios", async () => {
    expect((await proxy(request("/portfolio"))).headers.get("location")).toBeNull();
    expect((await proxy(request("/portfolios"))).headers.get("location")).toBeNull();
  });

  it("does not redirect unauthenticated /portfolio/accounts/abc", async () => {
    expect((await proxy(request("/portfolio/accounts/507f1f77bcf86cd799439011"))).headers.get("location")).toBeNull();
  });

  it("still redirects unauthenticated /watchlist to /xchat", async () => {
    const res = await proxy(request("/watchlist"));
    expect(res.headers.get("location")).toMatch(/\/xchat$/);
  });

  it("returns 401 for unauthenticated API matched by middleware (e.g. /api/admin)", async () => {
    const res = await proxy(request("/api/admin/users"));
    expect(res.status).toBe(401);
  });

  it("allows /xoptions when session cookie present", async () => {
    const origFetch = globalThis.fetch.bind(globalThis);
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockImplementation(async (input, init) => {
      const url =
        typeof input === "string"
          ? input
          : input instanceof URL
            ? input.href
            : (input as Request).url;
      if (url.includes("/api/internal/authz/session-grounding")) {
        return new Response(JSON.stringify({ ok: true }), { status: 200 });
      }
      if (url.includes("/api/internal/authz/billing-access")) {
        return new Response(JSON.stringify({ data: { requiresBilling: false } }), { status: 200 });
      }
      return origFetch(input as RequestInfo, init as RequestInit);
    });
    try {
      const res = await proxy(request("/xoptions", "signed"));
      expect(res.headers.get("location")).toBeNull();
    } finally {
      fetchSpy.mockRestore();
    }
  });

  it("fail-opens session grounding when internal fetch throws (no 401 / session strip on /api/personas)", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
      const url =
        typeof input === "string"
          ? input
          : input instanceof URL
            ? input.href
            : (input as Request).url;
      if (url.includes("/api/internal/authz/session-grounding")) {
        throw new Error("simulated edge-to-origin fetch failure");
      }
      throw new Error(`unexpected fetch ${url}`);
    });
    try {
      const res = await proxy(request("/api/personas", "signed-session"));
      expect(res.status).not.toBe(401);
    } finally {
      fetchSpy.mockRestore();
    }
  });

  it("fail-opens session grounding on 503 from session-grounding route", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
      const url =
        typeof input === "string"
          ? input
          : input instanceof URL
            ? input.href
            : (input as Request).url;
      if (url.includes("/api/internal/authz/session-grounding")) {
        return new Response("upstream", { status: 503 });
      }
      throw new Error(`unexpected fetch ${url}`);
    });
    try {
      const res = await proxy(request("/api/personas", "signed-session"));
      expect(res.status).not.toBe(401);
    } finally {
      fetchSpy.mockRestore();
    }
  });

  it("still denies when session-grounding returns 401 (invalid session)", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
      const url =
        typeof input === "string"
          ? input
          : input instanceof URL
            ? input.href
            : (input as Request).url;
      if (url.includes("/api/internal/authz/session-grounding")) {
        return new Response(JSON.stringify({ ok: false, code: "no_tenant_membership" }), {
          status: 401
        });
      }
      throw new Error(`unexpected fetch ${url}`);
    });
    try {
      const res = await proxy(request("/api/personas", "signed-session"));
      expect(res.status).toBe(401);
      const json = (await res.json()) as { code?: string };
      expect(json.code).toBe("session_not_grounded");
    } finally {
      fetchSpy.mockRestore();
    }
  });
});
