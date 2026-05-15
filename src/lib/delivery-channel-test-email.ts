import { z } from "zod";

export const DELIVERY_CHANNEL_TEST_EMAIL_DEFAULT_SUBJECT = "aTx Advisor — delivery channel test";

const MAX_SUBJECT_LEN = 200;

function trimEnv(value: string | undefined): string | undefined {
  if (value === undefined || value === null) {
    return undefined;
  }
  const t = String(value).trim();
  return t.length > 0 ? t : undefined;
}

export type ResolveDeliveryChannelTestEmailResult =
  | {
      ok: true;
      to: string;
      subject: string;
      usedEnvRecipientOverride: boolean;
    }
  | { ok: false; error: string };

/**
 * Resolves To + subject for admin **Send test** on email delivery channels only.
 * - Optional **`DESK_DELIVERY_CHANNEL_TEST_TO`**: when set to a valid email, tests send there (ops-safe) instead of the channel `emailTo`.
 *   **Does not apply** to access-request approval mail — those always go to the applicant (`resolveAccessApprovalNotifyEmail`).
 * - Optional **`DESK_DELIVERY_CHANNEL_TEST_SUBJECT`**: overrides the test email subject (max 200 chars); default {@link DELIVERY_CHANNEL_TEST_EMAIL_DEFAULT_SUBJECT}.
 * Scheduled/task delivery continues to use the channel row as stored — this affects tests only.
 */
export function resolveDeliveryChannelTestEmail(
  channelEmailTo: string | undefined
): ResolveDeliveryChannelTestEmailResult {
  const envTo = trimEnv(process.env.DESK_DELIVERY_CHANNEL_TEST_TO);
  if (envTo) {
    const parsed = z.string().email().safeParse(envTo);
    if (!parsed.success) {
      return {
        ok: false,
        error: "DESK_DELIVERY_CHANNEL_TEST_TO is set but is not a valid email address"
      };
    }
    return {
      ok: true,
      to: parsed.data,
      subject: resolveTestSubject(),
      usedEnvRecipientOverride: true
    };
  }

  const channel = trimEnv(channelEmailTo);
  if (!channel) {
    return {
      ok: false,
      error:
        "Email channel is missing emailTo — add a recipient or set DESK_DELIVERY_CHANNEL_TEST_TO to verify SMTP without using the channel address"
    };
  }
  const parsedChannel = z.string().email().safeParse(channel);
  if (!parsedChannel.success) {
    return { ok: false, error: "emailTo must be a valid email address" };
  }

  return {
    ok: true,
    to: parsedChannel.data,
    subject: resolveTestSubject(),
    usedEnvRecipientOverride: false
  };
}

function resolveTestSubject(): string {
  const raw = trimEnv(process.env.DESK_DELIVERY_CHANNEL_TEST_SUBJECT);
  const base = raw ?? DELIVERY_CHANNEL_TEST_EMAIL_DEFAULT_SUBJECT;
  return base.length > MAX_SUBJECT_LEN ? base.slice(0, MAX_SUBJECT_LEN) : base;
}
