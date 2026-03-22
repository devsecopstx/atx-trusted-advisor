import { NextResponse } from "next/server";

import { requireSessionUser } from "@/lib/auth";
import { requireAccountInPortfolio } from "@/lib/portfolio-access";
import { deletePositionForAccount } from "@/modules/core-admin/repository";

export async function DELETE(
  request: Request,
  context: { params: Promise<{ positionId: string }> }
) {
  const session = await requireSessionUser();
  if (session instanceof NextResponse) {
    return session;
  }

  const { positionId } = await context.params;
  const url = new URL(request.url);
  const portfolioId = url.searchParams.get("portfolioId")?.trim() ?? "";
  const accountId = url.searchParams.get("accountId")?.trim() ?? "";

  if (!portfolioId || !accountId) {
    return NextResponse.json(
      { error: "Query parameters portfolioId and accountId are required" },
      { status: 400 }
    );
  }

  const denied = await requireAccountInPortfolio(session, portfolioId, accountId);
  if (denied) {
    return denied;
  }

  const deleted = await deletePositionForAccount({
    userId: session.userId,
    tenantId: session.tenantId,
    portfolioId,
    accountId,
    positionId
  });

  if (!deleted) {
    return NextResponse.json({ error: "Position not found" }, { status: 404 });
  }

  return NextResponse.json({ ok: true });
}
