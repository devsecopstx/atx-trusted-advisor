import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { getDeskSmtpConfig } from "@/lib/desk-smtp";

const KEYS = [
  "SMTP_HOST",
  "SMTP_PORT",
  "SMTP_USER",
  "SMTP_PASS",
  "DESK_EMAIL_FROM",
  "SMTP_SECURE"
] as const;

describe("getDeskSmtpConfig", () => {
  const snapshot: Partial<Record<(typeof KEYS)[number], string | undefined>> = {};

  beforeEach(() => {
    for (const k of KEYS) {
      snapshot[k] = process.env[k];
      delete process.env[k];
    }
  });

  afterEach(() => {
    for (const k of KEYS) {
      const v = snapshot[k];
      if (v === undefined) {
        delete process.env[k];
      } else {
        process.env[k] = v;
      }
    }
  });

  it("returns null when host, user, or pass is missing", () => {
    expect(getDeskSmtpConfig()).toBeNull();
    process.env.SMTP_HOST = "mail.example.com";
    expect(getDeskSmtpConfig()).toBeNull();
    process.env.SMTP_USER = "u@example.com";
    expect(getDeskSmtpConfig()).toBeNull();
  });

  it("uses SMTP_USER as From when DESK_EMAIL_FROM is unset", () => {
    process.env.SMTP_HOST = "mail.example.com";
    process.env.SMTP_USER = "desk@example.com";
    process.env.SMTP_PASS = "secret";
    expect(getDeskSmtpConfig()).toEqual({
      host: "mail.example.com",
      port: 587,
      secure: false,
      user: "desk@example.com",
      pass: "secret",
      from: "desk@example.com"
    });
  });

  it("returns null when DESK_EMAIL_FROM is set but not a valid email", () => {
    process.env.SMTP_HOST = "mail.example.com";
    process.env.SMTP_USER = "u@example.com";
    process.env.SMTP_PASS = "secret";
    process.env.DESK_EMAIL_FROM = "not-an-email";
    expect(getDeskSmtpConfig()).toBeNull();
  });

  it("returns null when SMTP_PORT is out of range", () => {
    process.env.SMTP_HOST = "mail.example.com";
    process.env.SMTP_USER = "u@example.com";
    process.env.SMTP_PASS = "secret";
    process.env.SMTP_PORT = "99999";
    expect(getDeskSmtpConfig()).toBeNull();
  });

  it("honors SMTP_PORT and SMTP_SECURE", () => {
    process.env.SMTP_HOST = "mail.example.com";
    process.env.SMTP_USER = "u@example.com";
    process.env.SMTP_PASS = "secret";
    process.env.DESK_EMAIL_FROM = "u@example.com";
    process.env.SMTP_PORT = "465";
    process.env.SMTP_SECURE = "true";
    expect(getDeskSmtpConfig()).toEqual({
      host: "mail.example.com",
      port: 465,
      secure: true,
      user: "u@example.com",
      pass: "secret",
      from: "u@example.com"
    });
  });
});
