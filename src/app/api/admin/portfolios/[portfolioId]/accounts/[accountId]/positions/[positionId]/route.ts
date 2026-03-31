import { NextResponse } from "next/server";

import { requireAdminPortfolioForApi } from "@/lib/admin-portfolio-access";
import { requireAdminSession } from "@/lib/api-auth";
import { adminDeletePositionForPortfolioAccount } from "@/modules/core-admin/repository";

type RouteContext = {
  params: Promise<{ portfolioId: string; accountId: string; positionId: string }>;
};

export async function DELETE(_request: Request, context: RouteContext) {
  const session = await requireAdminSession();
  if (session instanceof NextResponse) {
    return session;
  }

  const { portfolioId, accountId, positionId } = await context.params;

  const access = await requireAdminPortfolioForApi(portfolioId, session);
  if (access instanceof NextResponse) {
    return access;
  }

  const deleted = await adminDeletePositionForPortfolioAccount({
    portfolioId,
    accountId,
    positionId
  });

  if (!deleted) {
    return NextResponse.json({ error: "Position or account not found" }, { status: 404 });
  }

  return NextResponse.json({ ok: true });
}
