import nodemailer from "nodemailer";
import { z } from "zod";

import { caughtErrorMessage } from "@/lib/caught-error";

/** Personal Gmail SMTP. Custom SMTP hosts are not used. */
export const GMAIL_SMTP_HOST = "smtp.gmail.com";
export const GMAIL_SMTP_PORT = 587;

export type DeskSmtpConfig = {
  host: string;
  port: number;
  secure: boolean;
  user: string;
  pass: string;
  from: string;
};

/** Last sendMail failure (best-effort; cleared by {@link consumeLastDeskSmtpSendError}). */
let lastDeskSmtpSendError: string | undefined;

export function consumeLastDeskSmtpSendError(): string | undefined {
  const out = lastDeskSmtpSendError;
  lastDeskSmtpSendError = undefined;
  return out;
}

function trimEnv(key: string): string | undefined {
  const v = process.env[key];
  if (v === undefined || v === null) {
    return undefined;
  }
  const t = String(v).trim();
  return t.length > 0 ? t : undefined;
}

function stripOptionalQuotes(raw: string): string {
  const t = raw.trim();
  if (t.length >= 2) {
    if ((t.startsWith('"') && t.endsWith('"')) || (t.startsWith("'") && t.endsWith("'"))) {
      return t.slice(1, -1).trim();
    }
  }
  return t;
}

/**
 * Resolves a RFC5322-style `From` (`Name <user@host>`) or plain email for nodemailer `from` + Zod checks.
 */
export function resolveDeskFromEnvelopeAddress(fromRaw: string | undefined, fallbackUser: string): string | null {
  const primary = stripOptionalQuotes((fromRaw ?? fallbackUser).trim());
  if (!primary) {
    return null;
  }
  const plain = z.string().email().safeParse(primary);
  if (plain.success) {
    return plain.data;
  }
  const angle = primary.match(/<([^>]+@[^>]+)>/);
  if (angle?.[1]) {
    const inner = z.string().email().safeParse(stripOptionalQuotes(angle[1].trim()));
    if (inner.success) {
      return inner.data;
    }
  }
  return null;
}

/**
 * When {@link getDeskSmtpConfig} is null, explains why (for admin UI / logs). No secrets.
 */
export function explainDeskSmtpConfigBlock(): string {
  const user = trimEnv("SMTP_USER");
  const pass = trimEnv("SMTP_PASS");
  const fromRaw = trimEnv("DESK_EMAIL_FROM");
  if (!user) {
    return "SMTP_USER is missing or empty (use your Gmail address).";
  }
  if (!pass) {
    return "SMTP_PASS is missing or empty.";
  }
  const from = resolveDeskFromEnvelopeAddress(fromRaw, user);
  if (!from) {
    return fromRaw
      ? "DESK_EMAIL_FROM is set but is not a valid email (use user@domain.com or Name <user@domain.com>)."
      : "DESK_EMAIL_FROM is missing and SMTP_USER is not a valid email address for From.";
  }
  const portRaw = trimEnv("SMTP_PORT") ?? "587";
  const port = Number.parseInt(portRaw, 10);
  if (!Number.isFinite(port) || port < 1 || port > 65535) {
    return `SMTP_PORT is invalid (${portRaw}).`;
  }
  return "Desk SMTP configuration could not be loaded (unknown).";
}

/**
 * Reads optional desk / transactional SMTP settings from the environment.
 * When any required piece is missing, portfolio `email` delivery channels are skipped (same as pre-SMTP behavior).
 *
 * Expected env (stage/prod: mount via GCP Secret Manager — see `scripts/ops/sync-desk-smtp-secrets-from-env.sh`):
 * - SMTP_USER (Gmail address), SMTP_PASS (Gmail app password), DESK_EMAIL_FROM
 * Transport is always `smtp.gmail.com:587` STARTTLS. `SMTP_HOST` is ignored.
 */
export function getDeskSmtpConfig(): DeskSmtpConfig | null {
  const user = trimEnv("SMTP_USER");
  const pass = trimEnv("SMTP_PASS");
  const fromRaw = trimEnv("DESK_EMAIL_FROM");
  if (!user || !pass) {
    return null;
  }

  const from = resolveDeskFromEnvelopeAddress(fromRaw, user);
  if (!from) {
    return null;
  }

  return {
    host: GMAIL_SMTP_HOST,
    port: GMAIL_SMTP_PORT,
    secure: false,
    user,
    pass,
    from
  };
}

export async function sendDeskHtmlEmail(input: {
  to: string;
  subject: string;
  text: string;
  html: string;
}): Promise<boolean> {
  const toParsed = z.string().email().safeParse(input.to.trim());
  if (!toParsed.success) {
    return false;
  }
  const cfg = getDeskSmtpConfig();
  if (!cfg) {
    return false;
  }
  try {
    const transport = nodemailer.createTransport({
      host: cfg.host,
      port: cfg.port,
      secure: cfg.secure,
      auth: { user: cfg.user, pass: cfg.pass }
    });
    await transport.sendMail({
      from: cfg.from,
      to: toParsed.data,
      subject: input.subject,
      text: input.text,
      html: input.html
    });
    return true;
  } catch (error) {
    lastDeskSmtpSendError = caughtErrorMessage(error).slice(0, 400);
    console.warn("[desk-smtp] sendMail failed (html)", { message: lastDeskSmtpSendError });
    return false;
  }
}

export async function sendDeskPlainEmail(input: {
  to: string;
  subject: string;
  text: string;
}): Promise<boolean> {
  const toParsed = z.string().email().safeParse(input.to.trim());
  if (!toParsed.success) {
    return false;
  }
  const cfg = getDeskSmtpConfig();
  if (!cfg) {
    return false;
  }
  try {
    const transport = nodemailer.createTransport({
      host: cfg.host,
      port: cfg.port,
      secure: cfg.secure,
      auth: { user: cfg.user, pass: cfg.pass }
    });
    await transport.sendMail({
      from: cfg.from,
      to: toParsed.data,
      subject: input.subject,
      text: input.text
    });
    return true;
  } catch (error) {
    lastDeskSmtpSendError = caughtErrorMessage(error).slice(0, 400);
    console.warn("[desk-smtp] sendMail failed (plain)", { message: lastDeskSmtpSendError });
    return false;
  }
}

function deskNotificationRetryCount(): number {
  const n = Number.parseInt(process.env.DESK_NOTIFICATION_SLACK_RETRIES ?? "2", 10);
  return Number.isFinite(n) && n >= 0 ? n : 2;
}

function deskNotificationRetryBaseMs(): number {
  const n = Number.parseInt(process.env.DESK_NOTIFICATION_RETRY_BASE_MS ?? "400", 10);
  return Number.isFinite(n) && n >= 50 ? n : 400;
}

async function sleepMs(ms: number): Promise<void> {
  await new Promise((r) => setTimeout(r, ms));
}

/** Same retry policy as Slack desk notifications (`DESK_NOTIFICATION_SLACK_RETRIES`, `DESK_NOTIFICATION_RETRY_BASE_MS`). */
/** Same retry policy as {@link sendDeskPlainEmailWithRetry} for multipart/alternative desk mail. */
export async function sendDeskHtmlEmailWithRetry(input: {
  to: string;
  subject: string;
  text: string;
  html: string;
}): Promise<boolean> {
  const maxExtra = deskNotificationRetryCount();
  let ok = false;
  for (let attempt = 0; attempt <= maxExtra; attempt++) {
    ok = await sendDeskHtmlEmail(input);
    if (ok) {
      return true;
    }
    if (attempt < maxExtra) {
      await sleepMs(deskNotificationRetryBaseMs() * (attempt + 1));
    }
  }
  return false;
}

export async function sendDeskPlainEmailWithRetry(
  to: string,
  subject: string,
  text: string
): Promise<boolean> {
  const maxExtra = deskNotificationRetryCount();
  let ok = false;
  for (let attempt = 0; attempt <= maxExtra; attempt++) {
    ok = await sendDeskPlainEmail({ to, subject, text });
    if (ok) {
      return true;
    }
    if (attempt < maxExtra) {
      await sleepMs(deskNotificationRetryBaseMs() * (attempt + 1));
    }
  }
  return false;
}
