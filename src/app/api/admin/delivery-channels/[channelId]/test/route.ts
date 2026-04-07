import { NextResponse } from "next/server";

import { requireAdminSession, requireAdminTenantIdHex } from "@/lib/api-auth";
import { proxyAdminDeliveryChannelsRequestToBackend } from "@/lib/backend-bff";
import { resolveDeliveryChannelTestEmail } from "@/lib/delivery-channel-test-email";
import { sendDeskPlainEmailWithRetry } from "@/lib/desk-smtp";
import { postSlackIncomingWebhook } from "@/lib/post-slack-incoming-webhook";
import { getAdminDeliveryChannelById } from "@/modules/core-admin/repository";

function buildDeliveryChannelTestMessage(tenantId: string): string {
  return `hello from atx | tenant=${tenantId} | at=${new Date().toISOString()}`;
}

type RouteContext = {
  params: Promise<{ channelId: string }>;
};

export async function POST(request: Request, context: RouteContext) {
  const proxied = await proxyAdminDeliveryChannelsRequestToBackend(request);
  if (proxied) {
    return proxied;
  }

  const session = await requireAdminSession();
  if (session instanceof NextResponse) {
    return session;
  }

  const tenantIdHex = await requireAdminTenantIdHex(session);
  if (tenantIdHex instanceof NextResponse) {
    return tenantIdHex;
  }

  const { channelId } = await context.params;
  const channel = await getAdminDeliveryChannelById(channelId, { tenantId: tenantIdHex });
  if (!channel) {
    return NextResponse.json({ error: "Delivery channel not found" }, { status: 404 });
  }

  const testMessage = buildDeliveryChannelTestMessage(tenantIdHex);

  if (channel.deliveryTarget === "in_app") {
    return NextResponse.json({
      ok: true,
      deliveryTarget: "in_app",
      message: testMessage,
      inAppPreview: true,
      detail:
        "In-app preview: use the on-screen sample notification (and optional browser notification if allowed). No external send."
    });
  }

  if (channel.deliveryTarget === "email") {
    const resolved = resolveDeliveryChannelTestEmail(channel.emailTo);
    if (!resolved.ok) {
      return NextResponse.json({ error: resolved.error }, { status: 400 });
    }
    const { to, subject, usedEnvRecipientOverride } = resolved;
    const ok = await sendDeskPlainEmailWithRetry(to, subject, testMessage);
    if (!ok) {
      return NextResponse.json(
        {
          error:
            "SMTP send failed — set SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, DESK_EMAIL_FROM on the app (see deploy-and-ops.md)"
        },
        { status: 502 }
      );
    }
    const detail = usedEnvRecipientOverride
      ? `SMTP test sent to ${to} (DESK_DELIVERY_CHANNEL_TEST_TO override; scheduled sends still use the channel recipient). Check that inbox (and spam).`
      : `SMTP test sent to ${to}. Check that inbox (and spam).`;
    return NextResponse.json({
      ok: true,
      deliveryTarget: "email",
      message: testMessage,
      detail,
      usedEnvRecipientOverride
    });
  }

  const url = channel.slackWebhookUrl?.trim();
  if (!url) {
    return NextResponse.json(
      { error: "Slack channel is missing slackWebhookUrl" },
      { status: 400 }
    );
  }

  const ok = await postSlackIncomingWebhook(url, { text: testMessage });
  if (!ok) {
    return NextResponse.json(
      { error: "Slack webhook test failed (check URL or Slack app configuration)" },
      { status: 502 }
    );
  }

  return NextResponse.json({
    ok: true,
    deliveryTarget: "slack",
    message: testMessage,
    detail: "Test message posted to the configured Slack incoming webhook."
  });
}
