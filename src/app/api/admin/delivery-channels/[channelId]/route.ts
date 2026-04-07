import { NextResponse } from "next/server";
import { z } from "zod";

import { requireAdminSession, requireAdminTenantIdHex } from "@/lib/api-auth";
import { proxyAdminDeliveryChannelsRequestToBackend } from "@/lib/backend-bff";
import { isSlackIncomingWebhookUrl } from "@/lib/post-slack-incoming-webhook";
import { createAuditEvent } from "@/modules/audit/repository";
import {
    deleteAdminDeliveryChannelById,
    getAdminDeliveryChannelById,
    updateAdminDeliveryChannelById
} from "@/modules/core-admin/repository";
import { serializeAdminDeliveryChannel } from "@/modules/core-admin/serialize-delivery-channel";
import type { AdminDeliveryChannel } from "@/modules/core-admin/types";

type RouteContext = {
  params: Promise<{ channelId: string }>;
};

type MergedAdminChannel = {
  name: string;
  deliveryTarget: "in_app" | "slack" | "email";
  slackWebhookUrl?: string;
  emailTo?: string;
};

function mergedChannel(
  existing: AdminDeliveryChannel,
  patch: {
    name?: string;
    deliveryTarget?: "in_app" | "slack" | "email";
    slackWebhookUrl?: string;
    emailTo?: string;
  }
): MergedAdminChannel {
  const name = patch.name !== undefined ? patch.name.trim() : existing.name;
  const deliveryTarget = patch.deliveryTarget ?? existing.deliveryTarget;

  if (deliveryTarget === "in_app") {
    return { name, deliveryTarget };
  }

  if (deliveryTarget === "slack") {
    let slackWebhookUrl: string | undefined;
    if (patch.slackWebhookUrl !== undefined) {
      slackWebhookUrl = patch.slackWebhookUrl.trim() || undefined;
    } else {
      slackWebhookUrl = existing.slackWebhookUrl?.trim();
    }
    return { name, deliveryTarget, slackWebhookUrl };
  }

  let emailTo: string | undefined;
  if (patch.emailTo !== undefined) {
    emailTo = patch.emailTo.trim() || undefined;
  } else {
    emailTo = existing.emailTo?.trim();
  }
  return { name, deliveryTarget, emailTo };
}

function buildRepoPatch(
  existing: AdminDeliveryChannel,
  parsed: z.infer<typeof patchSchema>
): Partial<Pick<AdminDeliveryChannel, "name" | "deliveryTarget" | "slackWebhookUrl" | "emailTo">> {
  const out: Partial<Pick<AdminDeliveryChannel, "name" | "deliveryTarget" | "slackWebhookUrl" | "emailTo">> =
    {};
  if (parsed.name !== undefined) {
    out.name = parsed.name.trim();
  }
  if (parsed.deliveryTarget !== undefined) {
    out.deliveryTarget = parsed.deliveryTarget;
  }
  const effectiveTarget = parsed.deliveryTarget ?? existing.deliveryTarget;
  if (parsed.slackWebhookUrl !== undefined && effectiveTarget === "slack") {
    out.slackWebhookUrl = parsed.slackWebhookUrl;
  }
  if (parsed.emailTo !== undefined && effectiveTarget === "email") {
    out.emailTo = parsed.emailTo;
  }
  return out;
}

const patchSchema = z
  .object({
    name: z.string().trim().min(1).max(120).optional(),
    deliveryTarget: z.enum(["in_app", "slack", "email"]).optional(),
    slackWebhookUrl: z.string().optional(),
    emailTo: z.string().optional()
  })
  .refine(
    (v) =>
      v.name !== undefined ||
      v.deliveryTarget !== undefined ||
      v.slackWebhookUrl !== undefined ||
      v.emailTo !== undefined,
    { message: "Provide at least one field to update." }
  );

export async function GET(request: Request, context: RouteContext) {
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
  const row = await getAdminDeliveryChannelById(channelId, { tenantId: tenantIdHex });
  if (!row) {
    return NextResponse.json({ error: "Delivery channel not found" }, { status: 404 });
  }

  return NextResponse.json({ data: serializeAdminDeliveryChannel(row) });
}

export async function PATCH(request: Request, context: RouteContext) {
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
  const existing = await getAdminDeliveryChannelById(channelId, { tenantId: tenantIdHex });
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
  if (merged.deliveryTarget === "email") {
    const em = merged.emailTo;
    if (!em) {
      return NextResponse.json(
        { error: "emailTo is required when deliveryTarget is email" },
        { status: 400 }
      );
    }
    if (!z.string().email().safeParse(em).success) {
      return NextResponse.json({ error: "emailTo must be a valid email address" }, { status: 400 });
    }
  }

  const patchForRepo = buildRepoPatch(existing, parsed.data);

  const updated = await updateAdminDeliveryChannelById({
    channelId,
    tenantId: tenantIdHex,
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
  const existing = await getAdminDeliveryChannelById(channelId, { tenantId: tenantIdHex });
  if (!existing) {
    return NextResponse.json({ error: "Delivery channel not found" }, { status: 404 });
  }

  const deleted = await deleteAdminDeliveryChannelById(channelId, { tenantId: tenantIdHex });
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
