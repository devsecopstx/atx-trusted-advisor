import { getDeskSmtpConfig, sendDeskPlainEmailWithRetry } from "@/lib/desk-smtp";
import { postSlackIncomingWebhook } from "@/lib/post-slack-incoming-webhook";
import { adminListPortfolioDeliveryChannels } from "@/modules/core-admin/repository";

export type DeskNotificationEvent = {
  title: string;
  body?: string;
  symbol?: string;
};

export type PortfolioDeskDispatchResult = {
  slack: { targets: number; postsOk: number };
  /** Enabled `email` channels: sent when SMTP env is set; skipped when SMTP unset; failed on SMTP errors. */
  email: { targets: number; sent: number; skipped: number; failed: number };
  sms: { targets: number; skipped: number };
  push: { targets: number; skipped: number };
};

function buildDeskEventText(events: ReadonlyArray<DeskNotificationEvent>): string {
  return (
    `*aTx⚡Finance* — desk alerts (${events.length})\n` +
    events
      .map((e) => {
        const sym = e.symbol ? ` \`${e.symbol}\`` : "";
        const body = e.body?.trim() ? `\n${e.body.trim()}` : "";
        return `• *${e.title}*${sym}${body}`;
      })
      .join("\n\n")
  );
}

function deskNotificationRetryCount(): number {
  const n = Number.parseInt(process.env.DESK_NOTIFICATION_SLACK_RETRIES ?? "2", 10);
  return Number.isFinite(n) && n >= 0 ? n : 2;
}

function deskNotificationRetryBaseMs(): number {
  const n = Number.parseInt(process.env.DESK_NOTIFICATION_RETRY_BASE_MS ?? "400", 10);
  return Number.isFinite(n) && n >= 50 ? n : 400;
}

async function sleep(ms: number): Promise<void> {
  await new Promise((r) => setTimeout(r, ms));
}

async function postSlackIncomingWebhookWithRetry(
  webhookUrl: string,
  payload: { text: string }
): Promise<boolean> {
  const maxExtra = deskNotificationRetryCount();
  let ok = false;
  for (let attempt = 0; attempt <= maxExtra; attempt++) {
    ok = await postSlackIncomingWebhook(webhookUrl, payload);
    if (ok) {
      return true;
    }
    if (attempt < maxExtra) {
      await sleep(deskNotificationRetryBaseMs() * (attempt + 1));
    }
  }
  return ok;
}

/**
 * Fan-out desk events to portfolio delivery channels: Slack webhooks (live + retries),
 * SMTP email when `SMTP_*` + `DESK_EMAIL_FROM` are set, plus SMS / push (still skipped until wired).
 */
export async function dispatchPortfolioDeskEvents(
  portfolioIdHex: string,
  events: ReadonlyArray<DeskNotificationEvent>
): Promise<PortfolioDeskDispatchResult> {
  const empty: PortfolioDeskDispatchResult = {
    slack: { targets: 0, postsOk: 0 },
    email: { targets: 0, sent: 0, skipped: 0, failed: 0 },
    sms: { targets: 0, skipped: 0 },
    push: { targets: 0, skipped: 0 }
  };
  if (events.length === 0) {
    return empty;
  }

  const channels = await adminListPortfolioDeliveryChannels(portfolioIdHex);
  const text = buildDeskEventText(events);
  const smtpReady = getDeskSmtpConfig() !== null;

  let slackTargets = 0;
  let postsOk = 0;
  let emailTargets = 0;
  let emailSent = 0;
  let emailFailed = 0;
  let smsTargets = 0;
  let pushTargets = 0;

  for (const ch of channels) {
    if (!ch.enabled) {
      continue;
    }
    switch (ch.kind) {
      case "slack_webhook": {
        if (ch.destination.trim().length === 0) {
          break;
        }
        slackTargets += 1;
        if (await postSlackIncomingWebhookWithRetry(ch.destination, { text })) {
          postsOk += 1;
        }
        break;
      }
      case "email": {
        emailTargets += 1;
        if (!smtpReady) {
          break;
        }
        const to = ch.destination.trim();
        const ok = await sendDeskPlainEmailWithRetry(
          to,
          "aTx Finance — desk alerts",
          text.replace(/\*/g, "")
        );
        if (ok) {
          emailSent += 1;
        } else {
          emailFailed += 1;
        }
        break;
      }
      case "sms": {
        smsTargets += 1;
        break;
      }
      case "push": {
        pushTargets += 1;
        break;
      }
    }
  }

  return {
    slack: { targets: slackTargets, postsOk },
    email: {
      targets: emailTargets,
      sent: emailSent,
      skipped: smtpReady ? 0 : emailTargets,
      failed: emailFailed
    },
    sms: { targets: smsTargets, skipped: smsTargets },
    push: { targets: pushTargets, skipped: pushTargets }
  };
}

/**
 * Slack-only projection — matches historical `{ targets, postsOk }` for callers that only care about Slack.
 */
export async function dispatchPortfolioDeskEventsToSlack(
  portfolioIdHex: string,
  events: ReadonlyArray<DeskNotificationEvent>
): Promise<{ targets: number; postsOk: number }> {
  const r = await dispatchPortfolioDeskEvents(portfolioIdHex, events);
  return { targets: r.slack.targets, postsOk: r.slack.postsOk };
}
