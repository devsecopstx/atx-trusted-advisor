import { NextResponse } from "next/server";
import { z } from "zod";

import { buildPortfolioSummaryPayload } from "@/lib/portfolio-api-response";
import { requireSessionUser } from "@/lib/auth";
import { requirePortfolioForSessionUser } from "@/lib/portfolio-access";
import { getPortfolioByIdForSessionUser, updatePortfolioForUser } from "@/modules/core-admin/repository";

type RouteContext = {
  params: Promise<{ portfolioId: string }>;
};

const patchPortfolioSchema = z.object({
  name: z.string().trim().min(1).max(200)
});

export async function GET(_: Request, context: RouteContext) {
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

  const updated = await updatePortfolioForUser({
    userId: session.userId,
    tenantId: session.tenantId,
    portfolioId,
    name: parsed.data.name
  });
  if (!updated?._id) {
    return NextResponse.json({ error: "Portfolio not found" }, { status: 404 });
  }

  const data = await buildPortfolioSummaryPayload(session, updated);
  return NextResponse.json({ data });
}
