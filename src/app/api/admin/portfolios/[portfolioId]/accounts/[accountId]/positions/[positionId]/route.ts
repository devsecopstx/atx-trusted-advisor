import { NextResponse } from "next/server";

import { requireAdminPortfolioForApi } from "@/lib/admin-portfolio-access";
import { requireAdminSession } from "@/lib/api-auth";
import { proxyAdminUsersRequestToBackend } from "@/lib/backend-bff";
import { adminDeletePositionForPortfolioAccount } from "@/modules/core-admin/repository";

type RouteContext = {
  params: Promise<{ portfolioId: string; accountId: string; positionId: string }>;
};

export async function DELETE(request: Request, context: RouteContext) {
  const proxied = await proxyAdminUsersRequestToBackend(request);
  if (proxied) {
    return proxied;
  }

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

export async function PATCH(request: Request, context: RouteContext) {
  const proxied = await proxyAdminUsersRequestToBackend(request);
  if (proxied) {
    return proxied;
  }

  // Admin position edits currently go through POST (upsert by symbol) in the holdings console.
  // PATCH is supported via BFF proxy to the backend when available.
  return NextResponse.json(
    { error: "PATCH for admin portfolio positions requires ATXFINANCE_BACKEND_ORIGIN (BFF)" },
    { status: 501 }
  );
}
