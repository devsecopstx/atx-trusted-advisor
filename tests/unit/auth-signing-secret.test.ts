import { beforeEach, describe, expect, it, vi } from "vitest";

const getEnvMock = vi.fn();

vi.mock("@/lib/env", () => ({
  getEnv: () => getEnvMock()
}));

import { signPendingXLinkValue } from "@/lib/auth";

describe("auth signing secret (S-001)", () => {
  beforeEach(() => {
    getEnvMock.mockReset();
  });

  it("signs with AUTH_SECRET when present and long enough", () => {
    getEnvMock.mockReturnValue({ AUTH_SECRET: "a".repeat(32) });
    const signed = signPendingXLinkValue({ xUserId: "x1", username: "sam" });
    expect(signed).toContain(".");
    expect(signed.split(".")).toHaveLength(2);
  });

  it("does not fall back to X_OAUTH_CLIENT_SECRET when AUTH_SECRET is missing", () => {
    getEnvMock.mockReturnValue({
      AUTH_SECRET: undefined,
      X_OAUTH_CLIENT_SECRET: "oauth-client-secret-should-not-be-used-as-session-key"
    });
    expect(() => signPendingXLinkValue({ xUserId: "x1", username: "sam" })).toThrow(
      /AUTH_SECRET is required/
    );
  });

  it("rejects AUTH_SECRET shorter than 32 characters", () => {
    getEnvMock.mockReturnValue({ AUTH_SECRET: "too-short-secret" });
    expect(() => signPendingXLinkValue({ xUserId: "x1", username: "sam" })).toThrow(
      /AUTH_SECRET is required/
    );
  });
});
