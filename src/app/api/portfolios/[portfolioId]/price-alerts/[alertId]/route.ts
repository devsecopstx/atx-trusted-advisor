import { NextResponse } from "next/server";

import { requireSessionUser } from "@/lib/auth";
import { proxyPortfolioRequestToBackend } from "@/lib/backend-bff";
import { requirePortfolioForSessionUser } from "@/lib/portfolio-access";
import { createAuditEvent } from "@/modules/audit/repository";
import { expirePortfolioPriceAlertByIdForUser } from "@/modules/price-alerts/portfolio-price-alerts-repository";

type RouteContext = {
  params: Promise<{ portfolioId: string; alertId: string }>;
};

export async function DELETE(request: Request, context: RouteContext) {
  const proxied = await proxyPortfolioRequestToBackend(request);
  if (proxied) {
    return proxied;
  }

  const session = await requireSessionUser();
  if (session instanceof NextResponse) {
    return session;
  }

  const { portfolioId, alertId } = await context.params;
  const denied = await requirePortfolioForSessionUser(session, portfolioId);
  if (denied) {
    return denied;
  }

  const ok = await expirePortfolioPriceAlertByIdForUser({
    alertIdHex: alertId,
    userId: session.userId,
    tenantId: session.tenantId,
    portfolioIdHex: portfolioId
  });

  if (!ok) {
    return NextResponse.json({ error: "Alert not found or already inactive" }, { status: 404 });
  }

  void createAuditEvent({
    entityType: "portfolio_price_alert",
    entityId: alertId,
    action: "portfolio_price_alert_expire_ui",
    actor: { userId: session.userId },
    details: { portfolioId }
  }).catch(() => {});

  return NextResponse.json({ ok: true });
}
