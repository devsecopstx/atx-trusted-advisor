import { afterEach, describe, expect, it, vi } from "vitest";

describe("desk-smtp from resolution", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("accepts Name <email@domain.com> in DESK_EMAIL_FROM", async () => {
    vi.stubEnv("SMTP_HOST", "smtp.example.com");
    vi.stubEnv("SMTP_USER", "user@example.com");
    vi.stubEnv("SMTP_PASS", "secret");
    vi.stubEnv("DESK_EMAIL_FROM", "Support <somegoodnewsatx@gmail.com>");
    const { getDeskSmtpConfig } = await import("@/lib/desk-smtp");
    const cfg = getDeskSmtpConfig();
    expect(cfg?.from).toBe("somegoodnewsatx@gmail.com");
  });

  it("falls back to SMTP_USER when DESK_EMAIL_FROM omitted and user is plain email", async () => {
    vi.stubEnv("SMTP_HOST", "smtp.example.com");
    vi.stubEnv("SMTP_USER", "relay@example.com");
    vi.stubEnv("SMTP_PASS", "secret");
    const { getDeskSmtpConfig } = await import("@/lib/desk-smtp");
    const cfg = getDeskSmtpConfig();
    expect(cfg?.from).toBe("relay@example.com");
  });

  it("explainDeskSmtpConfigBlock describes invalid from", async () => {
    vi.stubEnv("SMTP_HOST", "smtp.example.com");
    vi.stubEnv("SMTP_USER", "not-an-email");
    vi.stubEnv("SMTP_PASS", "secret");
    vi.stubEnv("DESK_EMAIL_FROM", "also-not");
    const { explainDeskSmtpConfigBlock, getDeskSmtpConfig } = await import("@/lib/desk-smtp");
    expect(getDeskSmtpConfig()).toBeNull();
    expect(explainDeskSmtpConfigBlock()).toMatch(/not a valid email/i);
  });
});
