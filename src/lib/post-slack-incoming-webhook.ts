/**
 * Post to a Slack Incoming Webhook URL (not the global SLACK_WEBHOOK_URL ops channel).
 * Host allowlist limits SSRF when destinations come from Mongo (portfolio_delivery_channels).
 */
export function isSlackIncomingWebhookUrl(raw: string): boolean {
  try {
    const u = new URL(raw.trim());
    return u.protocol === "https:" && u.hostname === "hooks.slack.com";
  } catch {
    return false;
  }
}

export async function postSlackIncomingWebhook(
  webhookUrl: string,
  payload: { text: string }
): Promise<boolean> {
  if (!isSlackIncomingWebhookUrl(webhookUrl)) {
    console.warn("[slack/webhook] rejected non-Slack HTTPS URL (hooks.slack.com only)");
    return false;
  }
  const text = payload.text.trim();
  if (!text) {
    return false;
  }
  try {
    const response = await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: text.slice(0, 12000) }),
    });
    if (!response.ok) {
      console.error(
        "[slack/webhook] post failed:",
        response.status,
        await response.text().catch(() => "")
      );
      return false;
    }
    return true;
  } catch (error) {
    console.error("[slack/webhook] error:", error instanceof Error ? error.message : error);
    return false;
  }
}
