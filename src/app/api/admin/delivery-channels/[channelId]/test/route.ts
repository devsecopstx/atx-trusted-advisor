import { NextResponse } from "next/server";

import { requireAdminSession } from "@/lib/api-auth";
import { proxyRequestToBackend } from "@/lib/backend-bff";
import { sendDeskPlainEmailWithRetry } from "@/lib/desk-smtp";
import { postSlackIncomingWebhook } from "@/lib/post-slack-incoming-webhook";
import { getAdminDeliveryChannelById } from "@/modules/core-admin/repository";

const TEST_MESSAGE = "hello from atx";

type RouteContext = {
  params: Promise<{ channelId: string }>;
};

export async function POST(request: Request, context: RouteContext) {
  const proxied = await proxyRequestToBackend(request);
  if (proxied) {
    return proxied;
  }

  const session = await requireAdminSession();
  if (session instanceof NextResponse) {
    return session;
  }

  const { channelId } = await context.params;
  const channel = await getAdminDeliveryChannelById(channelId, { tenantId: session.tenantId });
  if (!channel) {
    return NextResponse.json({ error: "Delivery channel not found" }, { status: 404 });
  }

  if (channel.deliveryTarget === "in_app") {
    return NextResponse.json({
      ok: true,
      deliveryTarget: "in_app",
      message: TEST_MESSAGE,
      detail: "In-app delivery has no external test send; channel is saved for future routing."
    });
  }

  if (channel.deliveryTarget === "email") {
    const to = channel.emailTo?.trim();
    if (!to) {
      return NextResponse.json({ error: "Email channel is missing emailTo" }, { status: 400 });
    }
    const ok = await sendDeskPlainEmailWithRetry(to, "aTx Finance — delivery channel test", TEST_MESSAGE);
    if (!ok) {
      return NextResponse.json(
        {
          error:
            "SMTP send failed — set SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, DESK_EMAIL_FROM on the app (see deploy-and-ops.md)"
        },
        { status: 502 }
      );
    }
    return NextResponse.json({
      ok: true,
      deliveryTarget: "email",
      message: TEST_MESSAGE
    });
  }

  const url = channel.slackWebhookUrl?.trim();
  if (!url) {
    return NextResponse.json(
      { error: "Slack channel is missing slackWebhookUrl" },
      { status: 400 }
    );
  }

  const ok = await postSlackIncomingWebhook(url, { text: TEST_MESSAGE });
  if (!ok) {
    return NextResponse.json(
      { error: "Slack webhook test failed (check URL or Slack app configuration)" },
      { status: 502 }
    );
  }

  return NextResponse.json({
    ok: true,
    deliveryTarget: "slack",
    message: TEST_MESSAGE
  });
}
