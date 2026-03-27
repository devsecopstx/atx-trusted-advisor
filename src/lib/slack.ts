import { getEnv } from "@/lib/env";

type SlackNotification = {
  text: string;
  blocks?: Array<Record<string, unknown>>;
};

export async function sendSlackNotification(
  notification: SlackNotification
): Promise<boolean> {
  const env = getEnv();
  const webhookUrl = env.SLACK_WEBHOOK_URL;

  if (!webhookUrl) {
    console.log("[slack] SLACK_WEBHOOK_URL not configured, skipping notification:", notification.text);
    return false;
  }

  try {
    const response = await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(notification)
    });

    if (!response.ok) {
      console.error("[slack] webhook failed:", response.status, await response.text().catch(() => ""));
      return false;
    }

    return true;
  } catch (error) {
    console.error("[slack] webhook error:", error instanceof Error ? error.message : error);
    return false;
  }
}

export function buildUserFeedbackNotification(params: {
  message: string;
  email: string;
  username?: string;
  userId: string;
  page?: string;
}): SlackNotification {
  const who = params.username ? `@${params.username}` : params.email;
  const page = params.page?.trim() ? ` • ${params.page.trim()}` : "";
  return {
    text: `💬 aTx Trusted Advisory app feedback${page} — ${who} (${params.userId})`,
    blocks: [
      {
        type: "header",
        text: { type: "plain_text", text: "💬 App user feedback" }
      },
      {
        type: "section",
        fields: [
          { type: "mrkdwn", text: `*Who:*\n${who} (${params.email})` },
          { type: "mrkdwn", text: `*User ID:*\n\`${params.userId}\`` }
        ]
      },
      {
        type: "section",
        text: { type: "mrkdwn", text: `*Message:*\n${params.message.slice(0, 2800)}` }
      }
    ]
  };
}

export function buildAccessRequestNotification(params: {
  email: string;
  username?: string;
  requestedRole: string;
  reason: string;
}): SlackNotification {
  const who = params.username ? `@${params.username} (${params.email})` : params.email;
  return {
    text: `🔔 New aTx Trusted Advisory access request from ${who}`,
    blocks: [
      {
        type: "header",
        text: { type: "plain_text", text: "🔔 New Access Request" }
      },
      {
        type: "section",
        fields: [
          { type: "mrkdwn", text: `*User:*\n${who}` },
          { type: "mrkdwn", text: `*Requested Role:*\n${params.requestedRole}` }
        ]
      },
      {
        type: "section",
        text: { type: "mrkdwn", text: `*Reason:*\n${params.reason}` }
      },
      {
        type: "context",
        elements: [
          { type: "mrkdwn", text: "Review at */admin/access-requests*" }
        ]
      }
    ]
  };
}
