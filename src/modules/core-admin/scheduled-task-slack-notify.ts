import { sendDeskPlainEmailWithRetry } from "@/lib/desk-smtp";
import { isSlackIncomingWebhookUrl, postSlackIncomingWebhook } from "@/lib/post-slack-incoming-webhook";
import { getAdminDeliveryChannelById } from "@/modules/core-admin/repository";
import type { ScheduledTask } from "@/modules/core-admin/types";
import { z } from "zod";

const MAX_OUTPUT_CHARS = 3500;

function escapeSlackMrkdwn(text: string): string {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function sanitizeCodeBlockBody(output: string): string {
  return output.replace(/```/g, "'''").slice(0, MAX_OUTPUT_CHARS);
}

/**
 * Posts a run summary to the task's linked `admin_delivery_channels` row: Slack webhook or SMTP email when configured.
 * Does nothing if `deliveryChannelTarget` is unset, channel is missing, or target is in_app.
 */
export async function notifyScheduledTaskSlackSummary(params: {
  task: ScheduledTask;
  status: "success" | "failed";
  output: string;
  durationMs: number;
  runIdHex: string;
  triggeredBy: string;
}): Promise<void> {
  const { task, status, output, durationMs, runIdHex, triggeredBy } = params;
  const target = task.deliveryChannelTarget;
  if (!target) {
    return;
  }

  const tenantId = task.tenantId ? task.tenantId.toHexString() : undefined;
  const channel = await getAdminDeliveryChannelById(target.toHexString(), { tenantId });
  if (!channel) {
    return;
  }

  if (channel.deliveryTarget === "email") {
    const to = channel.emailTo?.trim();
    if (!to || !z.string().email().safeParse(to).success) {
      console.warn(
        "[scheduled-task/desk-email] missing or invalid emailTo for delivery channel",
        channel._id?.toHexString() ?? "?"
      );
      return;
    }
    const emoji = status === "success" ? "OK" : "FAILED";
    const durationS = (durationMs / 1000).toFixed(1);
    const body = (output.trim() || "(no output)").replace(/```/g, "'''").slice(0, MAX_OUTPUT_CHARS);
    const text =
      `aTx Finance — scheduled job ${emoji}\n` +
      `Name: ${task.name}\n` +
      `Category: ${task.category}\n` +
      `Status: ${status}\n` +
      `Duration: ${durationS}s\n` +
      `Triggered by: ${triggeredBy}\n` +
      `Run ID: ${runIdHex}\n\n` +
      `Output:\n${body}`;
    const ok = await sendDeskPlainEmailWithRetry(
      to,
      `aTx Finance — scheduled task: ${task.name} (${status})`,
      text
    );
    if (!ok) {
      console.warn("[scheduled-task/desk-email] SMTP send failed for task", task._id?.toHexString() ?? "?");
    }
    return;
  }

  if (channel.deliveryTarget !== "slack") {
    return;
  }

  const url = channel.slackWebhookUrl?.trim();
  if (!url || !isSlackIncomingWebhookUrl(url)) {
    console.warn(
      "[scheduled-task/slack] missing or invalid Slack webhook URL for delivery channel",
      channel._id?.toHexString() ?? "?"
    );
    return;
  }

  const emoji = status === "success" ? ":white_check_mark:" : ":x:";
  const durationS = (durationMs / 1000).toFixed(1);
  const body = sanitizeCodeBlockBody(output.trim() || "(no output)");
  const name = escapeSlackMrkdwn(task.name);
  const cat = escapeSlackMrkdwn(task.category);
  const by = escapeSlackMrkdwn(triggeredBy);

  const text =
    `*aTx⚡Finance* — scheduled job ${emoji} *${name}*\n` +
    `• *Category:* \`${cat}\`\n` +
    `• *Status:* ${status}\n` +
    `• *Duration:* ${durationS}s\n` +
    `• *Triggered by:* ${by}\n` +
    `• *Run ID:* \`${runIdHex}\`\n` +
    `*Output:*\n\`\`\`\n${body}\n\`\`\``;

  const ok = await postSlackIncomingWebhook(url, { text });
  if (!ok) {
    console.warn("[scheduled-task/slack] post failed for task", task._id?.toHexString() ?? "?");
  }
}
