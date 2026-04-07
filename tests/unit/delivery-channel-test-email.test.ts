import { afterEach, describe, expect, it } from "vitest";

import {
    DELIVERY_CHANNEL_TEST_EMAIL_DEFAULT_SUBJECT,
    resolveDeliveryChannelTestEmail
} from "@/lib/delivery-channel-test-email";

describe("resolveDeliveryChannelTestEmail", () => {
  afterEach(() => {
    delete process.env.DESK_DELIVERY_CHANNEL_TEST_TO;
    delete process.env.DESK_DELIVERY_CHANNEL_TEST_SUBJECT;
  });

  it("uses channel emailTo when env override is unset", () => {
    const r = resolveDeliveryChannelTestEmail("ops@example.com");
    expect(r).toEqual({
      ok: true,
      to: "ops@example.com",
      subject: DELIVERY_CHANNEL_TEST_EMAIL_DEFAULT_SUBJECT,
      usedEnvRecipientOverride: false
    });
  });

  it("prefers DESK_DELIVERY_CHANNEL_TEST_TO over channel", () => {
    process.env.DESK_DELIVERY_CHANNEL_TEST_TO = "safe@example.com";
    const r = resolveDeliveryChannelTestEmail("ops@example.com");
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.to).toBe("safe@example.com");
      expect(r.usedEnvRecipientOverride).toBe(true);
    }
  });

  it("allows test when only env recipient is set (empty channel)", () => {
    process.env.DESK_DELIVERY_CHANNEL_TEST_TO = "safe@example.com";
    const r = resolveDeliveryChannelTestEmail("");
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.to).toBe("safe@example.com");
    }
  });

  it("rejects invalid DESK_DELIVERY_CHANNEL_TEST_TO", () => {
    process.env.DESK_DELIVERY_CHANNEL_TEST_TO = "not-an-email";
    const r = resolveDeliveryChannelTestEmail("ops@example.com");
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.error).toContain("DESK_DELIVERY_CHANNEL_TEST_TO");
    }
  });

  it("rejects missing channel when env override unset", () => {
    const r = resolveDeliveryChannelTestEmail(undefined);
    expect(r.ok).toBe(false);
  });

  it("rejects invalid channel emailTo when env unset", () => {
    const r = resolveDeliveryChannelTestEmail("bad");
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.error).toContain("emailTo");
    }
  });

  it("uses DESK_DELIVERY_CHANNEL_TEST_SUBJECT when set", () => {
    process.env.DESK_DELIVERY_CHANNEL_TEST_SUBJECT = "Custom subject line";
    const r = resolveDeliveryChannelTestEmail("ops@example.com");
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.subject).toBe("Custom subject line");
    }
  });

  it("truncates subject over 200 chars", () => {
    process.env.DESK_DELIVERY_CHANNEL_TEST_SUBJECT = "x".repeat(250);
    const r = resolveDeliveryChannelTestEmail("ops@example.com");
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.subject.length).toBe(200);
    }
  });
});
