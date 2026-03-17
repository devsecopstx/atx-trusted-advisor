import { NextResponse } from "next/server";

import { requireAdminSession } from "@/lib/api-auth";
import { listPortfolioAccounts } from "@/modules/core-admin/repository";

type RouteContext = {
  params: Promise<{
    portfolioId: string;
  }>;
};

export async function GET(_: Request, context: RouteContext) {
  const session = await requireAdminSession();
  if (session instanceof NextResponse) {
    return session;
  }

  const { portfolioId } = await context.params;
  const accounts = await listPortfolioAccounts({
    userId: session.userId,
    portfolioId,
    tenantId: session.tenantId
  });

  return NextResponse.json({ data: accounts });
}
