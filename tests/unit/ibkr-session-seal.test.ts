import { describe, expect, it } from "vitest";

import { sealIbkrCpSessionCookie, unsealIbkrCpSessionCookie } from "@/modules/ibkr-integration/session-seal";

describe("ibkr session seal", () => {
  it("round-trips a Client Portal cookie string", () => {
    const secret = "x".repeat(32);
    const plain = "api=abc123; path=/; secure";
    const sealed = sealIbkrCpSessionCookie(plain, secret);
    expect(sealed).not.toContain(plain);
    expect(unsealIbkrCpSessionCookie(sealed, secret)).toBe(plain);
  });

  it("returns null for tampered payload", () => {
    const secret = "y".repeat(32);
    const sealed = sealIbkrCpSessionCookie("ok", secret);
    const tampered = sealed.slice(0, -4) + "qqqq";
    expect(unsealIbkrCpSessionCookie(tampered, secret)).toBeNull();
  });

  it("returns null for wrong secret", () => {
    const sealed = sealIbkrCpSessionCookie("ok", "a".repeat(32));
    expect(unsealIbkrCpSessionCookie(sealed, "b".repeat(32))).toBeNull();
  });
});
