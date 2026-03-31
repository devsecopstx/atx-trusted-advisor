import { NextResponse } from "next/server";
import { z } from "zod";

import { requireAdminPortfolioForApi } from "@/lib/admin-portfolio-access";
import { requireAdminSession } from "@/lib/api-auth";
import { proxyRequestToBackend } from "@/lib/backend-bff";
import { adminDeletePortfolioAlert, adminUpdatePortfolioAlert } from "@/modules/core-admin/repository";
import type { PortfolioAlert } from "@/modules/core-admin/types";

type RouteContext = {
  params: Promise<{ portfolioId: string; alertId: string }>;
};

function serializeAlert(a: PortfolioAlert) {
  return {
    _id: a._id!.toHexString(),
    title: a.title,
    body: a.body ?? null,
    severity: a.severity,
    status: a.status,
    symbol: a.symbol ?? null,
    portfolioId: a.portfolioId.toHexString(),
    createdAt: a.createdAt.toISOString(),
    updatedAt: a.updatedAt.toISOString()
  };
}

const patchSchema = z
  .object({
    title: z.string().trim().min(1).max(200).optional(),
    body: z.union([z.string().trim().max(4000), z.null()]).optional(),
    severity: z.enum(["info", "warning", "critical"]).optional(),
    status: z.enum(["active", "acknowledged", "dismissed"]).optional(),
    symbol: z.union([z.string().trim().max(32), z.null()]).optional()
  })
  .refine(
    (d) =>
      d.title !== undefined ||
      d.body !== undefined ||
      d.severity !== undefined ||
      d.status !== undefined ||
      d.symbol !== undefined,
    { message: "At least one field is required" }
  );

export async function PATCH(request: Request, context: RouteContext) {
  const proxied = await proxyRequestToBackend(request);
  if (proxied) {
    return proxied;
  }

  const session = await requireAdminSession();
  if (session instanceof NextResponse) {
    return session;
  }

  const { portfolioId, alertId } = await context.params;
  const access = await requireAdminPortfolioForApi(portfolioId, session);
  if (access instanceof NextResponse) {
    return access;
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

  const patch: Parameters<typeof adminUpdatePortfolioAlert>[0]["patch"] = {};
  if (parsed.data.title !== undefined) patch.title = parsed.data.title;
  if (parsed.data.body !== undefined) patch.body = parsed.data.body ?? undefined;
  if (parsed.data.severity !== undefined) patch.severity = parsed.data.severity;
  if (parsed.data.status !== undefined) patch.status = parsed.data.status;
  if (parsed.data.symbol !== undefined) {
    patch.symbol = parsed.data.symbol === null ? "" : parsed.data.symbol;
  }

  const updated = await adminUpdatePortfolioAlert({ portfolioId, alertId, patch });
  if (!updated?._id) {
    return NextResponse.json({ error: "Alert not found" }, { status: 404 });
  }

  return NextResponse.json({ data: serializeAlert(updated) });
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

  const { portfolioId, alertId } = await context.params;
  const access = await requireAdminPortfolioForApi(portfolioId, session);
  if (access instanceof NextResponse) {
    return access;
  }

  const ok = await adminDeletePortfolioAlert(portfolioId, alertId);
  if (!ok) {
    return NextResponse.json({ error: "Alert not found" }, { status: 404 });
  }

  return NextResponse.json({ ok: true });
}
