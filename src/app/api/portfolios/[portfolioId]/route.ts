import { NextResponse } from "next/server";
import { z } from "zod";

import { requireSessionUser } from "@/lib/auth";
import { proxyRequestToBackend } from "@/lib/backend-bff";
import { requirePortfolioForSessionUser } from "@/lib/portfolio-access";
import { buildPortfolioSummaryPayload } from "@/lib/portfolio-api-response";
import { portfolioOutlookRequestSchema } from "@/lib/portfolio-outlook-api";
import {
    deletePortfolioForSessionUser,
    getPortfolioByIdForSessionUser,
    updatePortfolioForUser
} from "@/modules/core-admin/repository";

type RouteContext = {
  params: Promise<{ portfolioId: string }>;
};

const patchPortfolioSchema = z
  .object({
    name: z.string().trim().min(1).max(200).optional(),
    outlook: portfolioOutlookRequestSchema,
    broker_type: z
      .string()
      .trim()
      .max(32)
      .nullable()
      .optional()
      .transform((s) => (s === "" ? null : s)),
    portfolioKind: z.enum(["real_estate", "investments"]).nullable().optional(),
    isDefault: z.boolean().optional()
  })
  .refine((o) => Object.keys(o).length > 0, { message: "At least one field is required" });

export async function GET(request: Request, context: RouteContext) {
  const proxied = await proxyRequestToBackend(request);
  if (proxied) {
    return proxied;
  }

  const session = await requireSessionUser();
  if (session instanceof NextResponse) {
    return session;
  }

  const { portfolioId } = await context.params;
  const denied = await requirePortfolioForSessionUser(session, portfolioId);
  if (denied) {
    return denied;
  }

  const portfolio = await getPortfolioByIdForSessionUser({
    userId: session.userId,
    tenantId: session.tenantId,
    portfolioId
  });
  if (!portfolio?._id) {
    return NextResponse.json({ error: "Portfolio not found" }, { status: 404 });
  }

  const data = await buildPortfolioSummaryPayload(session, portfolio);
  return NextResponse.json({ data });
}

export async function PATCH(request: Request, context: RouteContext) {
  const proxied = await proxyRequestToBackend(request);
  if (proxied) {
    return proxied;
  }

  const session = await requireSessionUser();
  if (session instanceof NextResponse) {
    return session;
  }

  const { portfolioId } = await context.params;
  const denied = await requirePortfolioForSessionUser(session, portfolioId);
  if (denied) {
    return denied;
  }

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = patchPortfolioSchema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid request payload", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const p = parsed.data;
  const updated = await updatePortfolioForUser({
    userId: session.userId,
    tenantId: session.tenantId,
    portfolioId,
    ...(p.name !== undefined ? { name: p.name } : {}),
    ...(p.outlook !== undefined ? { outlook: p.outlook } : {}),
    ...(p.broker_type !== undefined ? { broker_type: p.broker_type } : {}),
    ...(p.portfolioKind !== undefined ? { portfolioKind: p.portfolioKind } : {}),
    ...(p.isDefault !== undefined ? { isDefault: p.isDefault } : {})
  });
  if (!updated?._id) {
    return NextResponse.json({ error: "Portfolio not found" }, { status: 404 });
  }

  const data = await buildPortfolioSummaryPayload(session, updated);
  return NextResponse.json({ data });
}

export async function DELETE(request: Request, context: RouteContext) {
  const proxied = await proxyRequestToBackend(request);
  if (proxied) {
    return proxied;
  }

  const session = await requireSessionUser();
  if (session instanceof NextResponse) {
    return session;
  }

  const { portfolioId } = await context.params;
  const denied = await requirePortfolioForSessionUser(session, portfolioId);
  if (denied) {
    return denied;
  }

  const result = await deletePortfolioForSessionUser({
    userId: session.userId,
    tenantId: session.tenantId,
    portfolioId
  });
  if (result.ok) {
    return NextResponse.json({ ok: true });
  }
  if (result.code === "LAST_PORTFOLIO") {
    return NextResponse.json(
      { error: "Cannot delete your only portfolio. Create another portfolio first." },
      { status: 409 }
    );
  }
  return NextResponse.json({ error: "Portfolio not found" }, { status: 404 });
}
