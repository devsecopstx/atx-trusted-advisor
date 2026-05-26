import { NextRequest } from "next/server";
import { describe, expect, it, vi } from "vitest";

import { GUEST_LANDING_COOKIE } from "@/lib/marketing/guest-landing-variant";
import { GUEST_TRIAL_INTENT_COOKIE } from "@/modules/identity/guest-trial";
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

  it("does not redirect unauthenticated /xchat (guest shell at URL)", async () => {
    const res = await proxy(request("/xchat"));
    expect(res.headers.get("location")).toBeNull();
  });

  it("persists ?for=advisor on / as guest landing cookie", async () => {
    const res = await proxy(request("/?for=advisor"));
    expect(res.headers.get("location")).toBeNull();
    const setCookie = res.headers.get("set-cookie") ?? "";
    expect(setCookie).toContain(`${GUEST_LANDING_COOKIE}=advisor`);
  });

  it("persists ?trial=1 on /home as guest trial intent cookie", async () => {
    const res = await proxy(request("/home?trial=1"));
    expect(res.headers.get("location")).toBeNull();
    const setCookie = res.headers.get("set-cookie") ?? "";
    expect(setCookie).toContain(`${GUEST_TRIAL_INTENT_COOKIE}=1`);
  });


  it("does not redirect unauthenticated /portfolio or /portfolios", async () => {
    expect((await proxy(request("/portfolio"))).headers.get("location")).toBeNull();
    expect((await proxy(request("/portfolios"))).headers.get("location")).toBeNull();
  });

  it("does not redirect unauthenticated /portfolio/accounts/abc", async () => {
    expect((await proxy(request("/portfolio/accounts/507f1f77bcf86cd799439011"))).headers.get("location")).toBeNull();
  });

  it("still redirects unauthenticated /watchlist to /login with next=/watchlist", async () => {
    const res = await proxy(request("/watchlist"));
    const loc = res.headers.get("location");
    expect(loc).toMatch(/\/login\?/);
    expect(loc).toContain("next=%2Fwatchlist");
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

  it("fail-opens session grounding on 404 from session-grounding route (dev cold compile / not ready)", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
      const url =
        typeof input === "string"
          ? input
          : input instanceof URL
            ? input.href
            : (input as Request).url;
      if (url.includes("/api/internal/authz/session-grounding")) {
        return new Response("Not Found", { status: 404 });
      }
      throw new Error(`unexpected fetch ${url}`);
    });
    try {
      const res = await proxy(request("/api/personas", "signed-session-404-grounding"));
      expect(res.status).not.toBe(401);
    } finally {
      fetchSpy.mockRestore();
    }
  });

  it("fail-opens tenant ux policy when internal route returns 200 with invalid JSON (V2 on, fail-open)", async () => {
    vi.stubEnv("TENANT_UX_ENFORCEMENT_V2", "true");
    vi.stubEnv("TENANT_UX_POLICY_FAIL_CLOSED", "false");
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
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
      if (url.includes("/api/internal/tenant-ux/policy")) {
        return new Response("not-json", { status: 200 });
      }
      throw new Error(`unexpected fetch ${url}`);
    });
    try {
      const res = await proxy(request("/api/xchat/ask", "signed-tenantux-json-failopen"));
      expect(res.status).toBeLessThan(400);
    } finally {
      fetchSpy.mockRestore();
      vi.unstubAllEnvs();
    }
  });

  it("returns 503 when tenant ux policy returns invalid JSON and TENANT_UX_POLICY_FAIL_CLOSED=true", async () => {
    vi.stubEnv("TENANT_UX_ENFORCEMENT_V2", "true");
    vi.stubEnv("TENANT_UX_POLICY_FAIL_CLOSED", "true");
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
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
      if (url.includes("/api/internal/tenant-ux/policy")) {
        return new Response("not-json", { status: 200 });
      }
      throw new Error(`unexpected fetch ${url}`);
    });
    try {
      const res = await proxy(request("/api/xchat/ask", "signed-tenantux-json-failclosed"));
      expect(res.status).toBe(503);
      const json = (await res.json()) as { code?: string };
      expect(json.code).toBe("tenant_ux_policy_unavailable");
    } finally {
      fetchSpy.mockRestore();
      vi.unstubAllEnvs();
    }
  });

  it("dedupes concurrent session-grounding fetches for the same session cookie", async () => {
    let sessionGroundingInFlight = 0;
    let sessionGroundingMaxConcurrent = 0;
    const origFetch = globalThis.fetch.bind(globalThis);
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockImplementation(async (input, init) => {
      const url =
        typeof input === "string"
          ? input
          : input instanceof URL
            ? input.href
            : (input as Request).url;
      if (url.includes("/api/internal/authz/session-grounding")) {
        sessionGroundingInFlight += 1;
        sessionGroundingMaxConcurrent = Math.max(
          sessionGroundingMaxConcurrent,
          sessionGroundingInFlight
        );
        await new Promise((r) => setTimeout(r, 25));
        sessionGroundingInFlight -= 1;
        return new Response(JSON.stringify({ ok: true }), { status: 200 });
      }
      if (url.includes("/api/internal/authz/billing-access")) {
        return new Response(JSON.stringify({ data: { requiresBilling: false } }), { status: 200 });
      }
      return origFetch(input as RequestInfo, init as RequestInit);
    });
    try {
      const cookie = "signed-session";
      await Promise.all([
        proxy(request("/api/personas", cookie)),
        proxy(request("/api/personas", cookie)),
        proxy(request("/api/personas", cookie))
      ]);
      expect(sessionGroundingMaxConcurrent).toBe(1);
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
      const res = await proxy(request("/api/personas", "signed-session-grounding-401"));
      expect(res.status).toBe(401);
      const json = (await res.json()) as { code?: string };
      expect(json.code).toBe("session_not_grounded");
    } finally {
      fetchSpy.mockRestore();
    }
  });
});
