import { NextResponse } from "next/server";
import { z } from "zod";

import { requireAdminSession } from "@/lib/api-auth";
import { proxyRequestToBackend } from "@/lib/backend-bff";
import { isSlackIncomingWebhookUrl } from "@/lib/post-slack-incoming-webhook";
import { createAuditEvent } from "@/modules/audit/repository";
import {
    createAdminDeliveryChannel,
    listAdminDeliveryChannels
} from "@/modules/core-admin/repository";
import type { AdminDeliveryChannel } from "@/modules/core-admin/types";

const createSchema = z
  .object({
    name: z.string().trim().min(1).max(120),
    deliveryTarget: z.enum(["in_app", "slack"]),
    slackWebhookUrl: z.string().optional()
  })
  .superRefine((data, ctx) => {
    if (data.deliveryTarget === "slack") {
      const u = data.slackWebhookUrl?.trim();
      if (!u) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "slackWebhookUrl is required when deliveryTarget is slack",
          path: ["slackWebhookUrl"]
        });
      } else if (!isSlackIncomingWebhookUrl(u)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Slack webhook must be an https://hooks.slack.com/services/… URL",
          path: ["slackWebhookUrl"]
        });
      }
    }
  });

export async function GET(request: Request) {
  const proxied = await proxyRequestToBackend(request);
  if (proxied) {
    return proxied;
  }

  const session = await requireAdminSession();
  if (session instanceof NextResponse) {
    return session;
  }

  const channels = await listAdminDeliveryChannels({ tenantId: session.tenantId });
  return NextResponse.json({ data: channels.map(serializeAdminDeliveryChannel) });
}

export async function POST(request: Request) {
  const proxied = await proxyRequestToBackend(request);
  if (proxied) {
    return proxied;
  }

  const session = await requireAdminSession();
  if (session instanceof NextResponse) {
    return session;
  }

  const json = await request.json();
  const parsed = createSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid delivery channel payload", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const created = await createAdminDeliveryChannel({
    name: parsed.data.name,
    deliveryTarget: parsed.data.deliveryTarget,
    slackWebhookUrl:
      parsed.data.deliveryTarget === "slack" ? parsed.data.slackWebhookUrl?.trim() : undefined,
    tenantId: session.tenantId
  });

  if (created._id) {
    await createAuditEvent({
      entityType: "admin_delivery_channel",
      entityId: created._id.toHexString(),
      action: "created",
      actor: {
        userId: session.userId,
        email: session.email,
        username: session.username
      },
      details: {
        name: created.name,
        deliveryTarget: created.deliveryTarget
      }
    });
  }

  return NextResponse.json({ data: serializeAdminDeliveryChannel(created) }, { status: 201 });
}

export function serializeAdminDeliveryChannel(ch: AdminDeliveryChannel) {
  return {
    _id: ch._id?.toHexString(),
    name: ch.name,
    deliveryTarget: ch.deliveryTarget,
    slackWebhookUrl: ch.slackWebhookUrl ?? "",
    createdAt: ch.createdAt.toISOString(),
    updatedAt: ch.updatedAt.toISOString()
  };
}
