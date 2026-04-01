import { NextResponse } from "next/server";
import { z } from "zod";

import { requireAdminSession } from "@/lib/api-auth";
import { proxyRequestToBackend } from "@/lib/backend-bff";
import { isSlackIncomingWebhookUrl } from "@/lib/post-slack-incoming-webhook";
import { createAuditEvent } from "@/modules/audit/repository";
import {
    deleteAdminDeliveryChannelById,
    getAdminDeliveryChannelById,
    updateAdminDeliveryChannelById
} from "@/modules/core-admin/repository";
import type { AdminDeliveryChannel } from "@/modules/core-admin/types";

import { serializeAdminDeliveryChannel } from "../route";

type RouteContext = {
  params: Promise<{ channelId: string }>;
};

function mergedChannel(
  existing: AdminDeliveryChannel,
  patch: {
    name?: string;
    deliveryTarget?: "in_app" | "slack";
    slackWebhookUrl?: string;
  }
): { name: string; deliveryTarget: "in_app" | "slack"; slackWebhookUrl?: string } {
  const name = patch.name !== undefined ? patch.name.trim() : existing.name;
  const deliveryTarget = patch.deliveryTarget ?? existing.deliveryTarget;
  if (deliveryTarget === "in_app") {
    return { name, deliveryTarget, slackWebhookUrl: undefined };
  }
  let slackWebhookUrl: string | undefined;
  if (patch.slackWebhookUrl !== undefined) {
    slackWebhookUrl = patch.slackWebhookUrl.trim() || undefined;
  } else {
    slackWebhookUrl = existing.slackWebhookUrl?.trim();
  }
  return { name, deliveryTarget, slackWebhookUrl };
}

const patchSchema = z
  .object({
    name: z.string().trim().min(1).max(120).optional(),
    deliveryTarget: z.enum(["in_app", "slack"]).optional(),
    slackWebhookUrl: z.string().optional()
  })
  .refine(
    (v) => v.name !== undefined || v.deliveryTarget !== undefined || v.slackWebhookUrl !== undefined,
    { message: "Provide at least one field to update." }
  );

export async function GET(request: Request, context: RouteContext) {
  const proxied = await proxyRequestToBackend(request);
  if (proxied) {
    return proxied;
  }

  const session = await requireAdminSession();
  if (session instanceof NextResponse) {
    return session;
  }

  const { channelId } = await context.params;
  const row = await getAdminDeliveryChannelById(channelId, { tenantId: session.tenantId });
  if (!row) {
    return NextResponse.json({ error: "Delivery channel not found" }, { status: 404 });
  }

  return NextResponse.json({ data: serializeAdminDeliveryChannel(row) });
}

export async function PATCH(request: Request, context: RouteContext) {
  const proxied = await proxyRequestToBackend(request);
  if (proxied) {
    return proxied;
  }

  const session = await requireAdminSession();
  if (session instanceof NextResponse) {
    return session;
  }

  const { channelId } = await context.params;
  const existing = await getAdminDeliveryChannelById(channelId, { tenantId: session.tenantId });
  if (!existing) {
    return NextResponse.json({ error: "Delivery channel not found" }, { status: 404 });
  }

  const json = await request.json();
  const parsed = patchSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid delivery channel payload", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const merged = mergedChannel(existing, parsed.data);
  if (!merged.name) {
    return NextResponse.json({ error: "name cannot be empty" }, { status: 400 });
  }
  if (merged.deliveryTarget === "slack") {
    const u = merged.slackWebhookUrl;
    if (!u) {
      return NextResponse.json(
        { error: "slackWebhookUrl is required when deliveryTarget is slack" },
        { status: 400 }
      );
    }
    if (!isSlackIncomingWebhookUrl(u)) {
      return NextResponse.json(
        { error: "Slack webhook must be an https://hooks.slack.com/services/… URL" },
        { status: 400 }
      );
    }
  }

  const patchForRepo = { ...parsed.data };
  if (merged.deliveryTarget === "in_app") {
    delete patchForRepo.slackWebhookUrl;
  }

  const updated = await updateAdminDeliveryChannelById({
    channelId,
    tenantId: session.tenantId,
    patch: patchForRepo
  });
  if (!updated) {
    return NextResponse.json({ error: "Delivery channel not found" }, { status: 404 });
  }

  await createAuditEvent({
    entityType: "admin_delivery_channel",
    entityId: channelId,
    action: "updated",
    actor: {
      userId: session.userId,
      email: session.email,
      username: session.username
    },
    details: {
      changedFields: Object.keys(parsed.data)
    }
  });

  return NextResponse.json({ data: serializeAdminDeliveryChannel(updated) });
}

export async function DELETE(request: Request, context: RouteContext) {
  const proxied = await proxyRequestToBackend(request);
  if (proxied) {
    return proxied;
  }

  const session = await requireAdminSession();
  if (session instanceof NextResponse) {
    return session;
  }

  const { channelId } = await context.params;
  const existing = await getAdminDeliveryChannelById(channelId, { tenantId: session.tenantId });
  if (!existing) {
    return NextResponse.json({ error: "Delivery channel not found" }, { status: 404 });
  }

  const deleted = await deleteAdminDeliveryChannelById(channelId, { tenantId: session.tenantId });
  if (!deleted) {
    return NextResponse.json({ error: "Delivery channel not found" }, { status: 404 });
  }

  await createAuditEvent({
    entityType: "admin_delivery_channel",
    entityId: channelId,
    action: "deleted",
    actor: {
      userId: session.userId,
      email: session.email,
      username: session.username
    },
    details: {
      name: existing.name
    }
  });

  return NextResponse.json({ ok: true });
}
