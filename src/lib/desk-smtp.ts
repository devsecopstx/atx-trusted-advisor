import nodemailer from "nodemailer";
import { z } from "zod";

export type DeskSmtpConfig = {
  host: string;
  port: number;
  secure: boolean;
  user: string;
  pass: string;
  from: string;
};

function trimEnv(key: string): string | undefined {
  const v = process.env[key];
  if (v === undefined || v === null) {
    return undefined;
  }
  const t = String(v).trim();
  return t.length > 0 ? t : undefined;
}

/**
 * Reads optional desk / transactional SMTP settings from the environment.
 * When any required piece is missing, portfolio `email` delivery channels are skipped (same as pre-SMTP behavior).
 *
 * Expected env (stage/prod: mount via GCP Secret Manager — see `scripts/ops/sync-desk-smtp-secrets-from-env.sh`):
 * - SMTP_HOST, SMTP_USER, SMTP_PASS, DESK_EMAIL_FROM
 * - SMTP_PORT (default 587)
 * - SMTP_SECURE: `true` / `1` for SMTPS (e.g. port 465); default false (STARTTLS on 587)
 */
export function getDeskSmtpConfig(): DeskSmtpConfig | null {
  const host = trimEnv("SMTP_HOST");
  const user = trimEnv("SMTP_USER");
  const pass = trimEnv("SMTP_PASS");
  const fromRaw = trimEnv("DESK_EMAIL_FROM");
  const from = fromRaw ?? user;
  if (!host || !user || !pass || !from) {
    return null;
  }

  const portRaw = trimEnv("SMTP_PORT") ?? "587";
  const port = Number.parseInt(portRaw, 10);
  if (!Number.isFinite(port) || port < 1 || port > 65535) {
    return null;
  }

  const secureRaw = trimEnv("SMTP_SECURE");
  const secure =
    secureRaw === "1" ||
    secureRaw?.toLowerCase() === "true" ||
    secureRaw?.toLowerCase() === "yes";

  const fromParsed = z.string().email().safeParse(from);
  if (!fromParsed.success) {
    return null;
  }

  return { host, port, secure, user, pass, from: fromParsed.data };
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
  } catch {
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
  } catch {
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
