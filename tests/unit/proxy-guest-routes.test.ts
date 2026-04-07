import { NextRequest } from "next/server";
import { describe, expect, it } from "vitest";

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
  it("does not redirect unauthenticated /xoptions (guest shell at URL)", () => {
    const res = proxy(request("/xoptions"));
    expect(res.headers.get("location")).toBeNull();
  });

  it("does not redirect unauthenticated /portfolio or /portfolios", () => {
    expect(proxy(request("/portfolio")).headers.get("location")).toBeNull();
    expect(proxy(request("/portfolios")).headers.get("location")).toBeNull();
  });

  it("does not redirect unauthenticated /portfolio/accounts/abc", () => {
    expect(proxy(request("/portfolio/accounts/507f1f77bcf86cd799439011")).headers.get("location")).toBeNull();
  });

  it("still redirects unauthenticated /watchlist to /xchat", () => {
    const res = proxy(request("/watchlist"));
    expect(res.headers.get("location")).toMatch(/\/xchat$/);
  });

  it("returns 401 for unauthenticated API matched by middleware (e.g. /api/admin)", () => {
    const res = proxy(request("/api/admin/users"));
    expect(res.status).toBe(401);
  });

  it("allows /xoptions when session cookie present", () => {
    const res = proxy(request("/xoptions", "signed"));
    expect(res.headers.get("location")).toBeNull();
  });
});
