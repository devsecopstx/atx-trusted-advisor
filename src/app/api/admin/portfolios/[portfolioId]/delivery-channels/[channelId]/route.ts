import { NextResponse } from "next/server";
import { z } from "zod";

import { requireAdminSession } from "@/lib/api-auth";
import {
  adminDeletePortfolioDeliveryChannel,
  adminGetPortfolioById,
  adminUpdatePortfolioDeliveryChannel
} from "@/modules/core-admin/repository";
import type { PortfolioDeliveryChannel } from "@/modules/core-admin/types";

type RouteContext = {
  params: Promise<{ portfolioId: string; channelId: string }>;
};

function serializeChannel(c: PortfolioDeliveryChannel) {
  return {
    _id: c._id!.toHexString(),
    kind: c.kind,
    label: c.label,
    destination: c.destination,
    enabled: c.enabled,
    portfolioId: c.portfolioId.toHexString(),
    createdAt: c.createdAt.toISOString(),
    updatedAt: c.updatedAt.toISOString()
  };
}

const patchSchema = z
  .object({
    kind: z.enum(["email", "slack_webhook", "sms", "push"]).optional(),
    label: z.string().trim().min(1).max(128).optional(),
    destination: z.string().trim().min(1).max(2048).optional(),
    enabled: z.boolean().optional()
  })
  .refine(
    (d) =>
      d.kind !== undefined ||
      d.label !== undefined ||
      d.destination !== undefined ||
      d.enabled !== undefined,
    { message: "At least one field is required" }
  );

export async function PATCH(request: Request, context: RouteContext) {
  const session = await requireAdminSession();
  if (session instanceof NextResponse) {
    return session;
  }

  const { portfolioId, channelId } = await context.params;
  const portfolio = await adminGetPortfolioById(portfolioId);
  if (!portfolio?._id) {
    return NextResponse.json({ error: "Portfolio not found" }, { status: 404 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid request payload", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const updated = await adminUpdatePortfolioDeliveryChannel({
    portfolioId,
    channelId,
    patch: parsed.data
  });
  if (!updated?._id) {
    return NextResponse.json({ error: "Delivery channel not found" }, { status: 404 });
  }

  return NextResponse.json({ data: serializeChannel(updated) });
}

export async function DELETE(_request: Request, context: RouteContext) {
  const session = await requireAdminSession();
  if (session instanceof NextResponse) {
    return session;
  }

  const { portfolioId, channelId } = await context.params;
  const portfolio = await adminGetPortfolioById(portfolioId);
  if (!portfolio?._id) {
    return NextResponse.json({ error: "Portfolio not found" }, { status: 404 });
  }

  const ok = await adminDeletePortfolioDeliveryChannel(portfolioId, channelId);
  if (!ok) {
    return NextResponse.json({ error: "Delivery channel not found" }, { status: 404 });
  }

  return NextResponse.json({ ok: true });
}
