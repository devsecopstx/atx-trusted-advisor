import { NextResponse } from "next/server";
import { z } from "zod";

import { requireAdminSession } from "@/lib/api-auth";
import { proxyRequestToBackend } from "@/lib/backend-bff";
import {
    adminCreatePortfolioDeliveryChannel,
    adminGetPortfolioById,
    adminListPortfolioDeliveryChannels
} from "@/modules/core-admin/repository";
import type { PortfolioDeliveryChannel } from "@/modules/core-admin/types";

type RouteContext = {
  params: Promise<{ portfolioId: string }>;
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

const postSchema = z.object({
  kind: z.enum(["email", "slack_webhook", "sms", "push"]),
  label: z.string().trim().min(1).max(128),
  destination: z.string().trim().min(1).max(2048),
  enabled: z.boolean().optional()
});

export async function GET(request: Request, context: RouteContext) {
  const proxied = await proxyRequestToBackend(request);
  if (proxied) {
    return proxied;
  }

  const session = await requireAdminSession();
  if (session instanceof NextResponse) {
    return session;
  }

  const { portfolioId } = await context.params;
  const portfolio = await adminGetPortfolioById(portfolioId);
  if (!portfolio?._id) {
    return NextResponse.json({ error: "Portfolio not found" }, { status: 404 });
  }

  const rows = await adminListPortfolioDeliveryChannels(portfolioId);
  return NextResponse.json({ data: rows.map(serializeChannel) });
}

export async function POST(request: Request, context: RouteContext) {
  const proxied = await proxyRequestToBackend(request);
  if (proxied) {
    return proxied;
  }

  const session = await requireAdminSession();
  if (session instanceof NextResponse) {
    return session;
  }

  const { portfolioId } = await context.params;
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

  const parsed = postSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid request payload", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const created = await adminCreatePortfolioDeliveryChannel({
    portfolioId,
    kind: parsed.data.kind,
    label: parsed.data.label,
    destination: parsed.data.destination,
    enabled: parsed.data.enabled
  });
  if (!created?._id) {
    return NextResponse.json({ error: "Could not create delivery channel" }, { status: 400 });
  }

  return NextResponse.json({ data: serializeChannel(created) }, { status: 201 });
}
