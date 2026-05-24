import { describe, expect, it } from "vitest";

import { formatBackendSessionCookieHeader } from "@/lib/backend-session-cookie";

describe("formatBackendSessionCookieHeader", () => {
  it("wraps a bare session token", () => {
    expect(formatBackendSessionCookieHeader("abc.def")).toBe("xf_core_session=abc.def");
  });

  it("preserves a full Cookie header", () => {
    const header = "other=1; xf_core_session=abc.def; z=2";
    expect(formatBackendSessionCookieHeader(header)).toBe(header);
  });

  it("preserves an already-prefixed single cookie", () => {
    expect(formatBackendSessionCookieHeader("xf_core_session=abc.def")).toBe("xf_core_session=abc.def");
  });
});
