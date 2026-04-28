import { describe, expect, it } from "vitest";

import { resolveAccessApprovalNotifyEmail } from "@/lib/access-request-notify-email";
import { buildXIdentityPlaceholderEmail } from "@/lib/x-identity-email";

describe("resolveAccessApprovalNotifyEmail", () => {
  it("returns real core email when present", () => {
    expect(
      resolveAccessApprovalNotifyEmail(
        { email: "pat@example.com" },
        { contactEmail: undefined }
      )
    ).toBe("pat@example.com");
  });

  it("falls back to contactEmail when core email is X placeholder", () => {
    const placeholder = buildXIdentityPlaceholderEmail("12345");
    expect(
      resolveAccessApprovalNotifyEmail(
        { email: placeholder },
        { contactEmail: "real@example.com" }
      )
    ).toBe("real@example.com");
  });

  it("returns null when only placeholder addresses exist", () => {
    const placeholder = buildXIdentityPlaceholderEmail("999");
    expect(
      resolveAccessApprovalNotifyEmail({ email: placeholder }, { contactEmail: placeholder })
    ).toBeNull();
  });

  it("returns null when emails missing", () => {
    expect(resolveAccessApprovalNotifyEmail({}, {})).toBeNull();
  });
});
