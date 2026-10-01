import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/env", () => ({
  getEnv: () => ({ AUTH_SECRET: "unit-test-auth-secret-32chars-xx" })
}));

import { parsePendingXLinkCookieValue, signPendingXLinkValue } from "@/lib/auth";

describe("pending X link cookie", () => {
  beforeEach(() => {
    vi.stubEnv("NODE_ENV", "test");
  });

  it("rejects unsigned base64 JSON", () => {
    const raw = Buffer.from(
      JSON.stringify({ xUserId: "attacker", username: "evil" }),
      "utf8"
    ).toString("base64url");
    expect(parsePendingXLinkCookieValue(raw)).toBeNull();
  });

  it("rejects a bad HMAC", () => {
    const signed = signPendingXLinkValue({ xUserId: "x1", username: "sam" });
    const [payload] = signed.split(".");
    expect(parsePendingXLinkCookieValue(`${payload}.aaaaaaaa`)).toBeNull();
  });

  it("round-trips a signed payload", () => {
    const signed = signPendingXLinkValue({
      xUserId: "x1",
      username: "sam",
      displayName: "Sam"
    });
    expect(parsePendingXLinkCookieValue(signed)).toEqual({
      xUserId: "x1",
      username: "sam",
      displayName: "Sam"
    });
  });

  it("rejects expired payloads", () => {
    const signed = signPendingXLinkValue({ xUserId: "x1", username: "sam" }, 1);
    expect(parsePendingXLinkCookieValue(signed, Date.now())).toBeNull();
  });
});
