import { postSlackIncomingWebhook } from "@/lib/post-slack-incoming-webhook";
import { adminListPortfolioDeliveryChannels } from "@/modules/core-admin/repository";

export type DeskNotificationEvent = {
  title: string;
  body?: string;
  symbol?: string;
};

/**
 * NotificationService (KISS) — fan out desk events to portfolio Slack incoming webhooks.
 * Uses `portfolio_delivery_channels` rows with `kind: slack_webhook` and `enabled: true`.
 */
export async function dispatchPortfolioDeskEventsToSlack(
  portfolioIdHex: string,
  events: ReadonlyArray<DeskNotificationEvent>
): Promise<{ targets: number; postsOk: number }> {
  if (events.length === 0) {
    return { targets: 0, postsOk: 0 };
  }

  const channels = await adminListPortfolioDeliveryChannels(portfolioIdHex);
  const slack = channels.filter(
    (c) => c.kind === "slack_webhook" && c.enabled && c.destination.trim().length > 0
  );
  if (slack.length === 0) {
    return { targets: 0, postsOk: 0 };
  }

  const text =
    `*aTx⚡Finance* — desk alerts (${events.length})\n` +
    events
      .map((e) => {
        const sym = e.symbol ? ` \`${e.symbol}\`` : "";
        const body = e.body?.trim() ? `\n${e.body.trim()}` : "";
        return `• *${e.title}*${sym}${body}`;
      })
      .join("\n\n");

  let postsOk = 0;
  for (const ch of slack) {
    const ok = await postSlackIncomingWebhook(ch.destination, { text });
    if (ok) {
      postsOk += 1;
    }
  }

  return { targets: slack.length, postsOk };
}
