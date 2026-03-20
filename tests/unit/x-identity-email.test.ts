import { describe, expect, it } from "vitest";

import {
    formatUserFacingIdentityLabel,
    isXIdentityPlaceholderEmail
} from "@/lib/x-identity-email";

describe("isXIdentityPlaceholderEmail", () => {
  it("detects synthetic x.identity.local emails", () => {
    expect(isXIdentityPlaceholderEmail("xid-abc@x.identity.local")).toBe(true);
    expect(isXIdentityPlaceholderEmail(undefined)).toBe(false);
    expect(isXIdentityPlaceholderEmail("real@example.com")).toBe(false);
  });
});

describe("formatUserFacingIdentityLabel", () => {
  it("prefers real email over placeholder", () => {
    expect(
      formatUserFacingIdentityLabel(
        { email: "a@b.com", username: "foo", xUserId: "1" },
        "uid"
      )
    ).toBe("a@b.com");
  });

  it("skips placeholder email for username", () => {
    expect(
      formatUserFacingIdentityLabel(
        { email: "xid-abc@x.identity.local", username: "grokfan", xUserId: "99" },
        "507f1f77bcf86cd799439011"
      )
    ).toBe("@grokfan");
  });

  it("uses xUserId when no real email or username", () => {
    expect(
      formatUserFacingIdentityLabel(
        { email: "xid-abc@x.identity.local", xUserId: "224499" },
        "507f1f77bcf86cd799439011"
      )
    ).toBe("224499");
  });

  it("falls back to user id", () => {
    expect(formatUserFacingIdentityLabel(undefined, "507f1f77bcf86cd799439011")).toBe(
      "507f1f77bcf86cd799439011"
    );
  });
});
