import { ObjectId } from "mongodb";
import { NextResponse } from "next/server";
import { z } from "zod";

import { requireSessionUser } from "@/lib/auth";
import { proxyPortfolioRequestToBackend } from "@/lib/backend-bff";
import { requirePortfolioForSessionUser } from "@/lib/portfolio-access";
import { normalizeSubscriptionPlan } from "@/lib/subscription-plan";
import { createAuditEvent } from "@/modules/audit/repository";
import { getPortfolioByIdForSessionUser } from "@/modules/core-admin/repository";
import { getCoreUserById } from "@/modules/identity/repository";
import { ensureUserAlertManagerScheduledTaskForTenant } from "@/modules/price-alerts/ensure-user-alert-manager-task";
import { MAX_NL_USER_PRICE_ALERT_RULES } from "@/modules/price-alerts/nl-price-alert-limits";
import type { PortfolioPriceAlertDoc } from "@/modules/price-alerts/portfolio-price-alert-types";
import {
    countActivePortfolioPriceAlertsForTenant,
    listActivePortfolioPriceAlertsForUser,
    listActivePortfolioPriceAlertsForUserPortfolio,
    upsertActivePortfolioPriceAlert
} from "@/modules/price-alerts/portfolio-price-alerts-repository";
import { canManageNlPriceAlerts } from "@/modules/xchat/plan-limits";

type RouteContext = {
  params: Promise<{ portfolioId: string }>;
};

function serializePriceAlert(a: PortfolioPriceAlertDoc) {
  return {
    id: a._id!.toHexString(),
    symbol: a.symbolNorm,
    ruleKind: a.ruleKind,
    targetPriceUsd: a.targetPriceUsd,
    portfolioId: a.portfolioId.toHexString(),
    portfolioName: a.portfolioName ?? null,
    lastReferencePrice: a.lastReferencePrice ?? null,
    status: a.status,
    expiresAt: a.expiresAt.toISOString(),
    updatedAt: a.updatedAt.toISOString(),
    createdAt: a.createdAt.toISOString()
  };
}

const postBodySchema = z.object({
  symbol: z.string().trim().min(1).max(32),
  targetPriceUsd: z.number().finite().positive().max(1_000_000),
  ruleKind: z.enum(["above", "below", "crosses"])
});

export async function GET(_request: Request, context: RouteContext) {
  const proxied = await proxyPortfolioRequestToBackend(_request);
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

  const rows = await listActivePortfolioPriceAlertsForUserPortfolio({
    userId: session.userId,
    tenantId: session.tenantId,
    portfolioIdHex: portfolioId
  });
  return NextResponse.json({ data: rows.map(serializePriceAlert) });
}

export async function POST(request: Request, context: RouteContext) {
  const proxied = await proxyPortfolioRequestToBackend(request);
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

  let plan: ReturnType<typeof normalizeSubscriptionPlan> = normalizeSubscriptionPlan(undefined);
  if (ObjectId.isValid(session.userId)) {
    const user = await getCoreUserById(new ObjectId(session.userId));
    plan = normalizeSubscriptionPlan(user?.subscriptionPlan);
  }
  if (!canManageNlPriceAlerts(plan, session.roles)) {
    return NextResponse.json(
      {
        error: "Natural-language price alerts require Premium+ with an advisor seat.",
        code: "plan_blocked_nl_price_alerts"
      },
      { status: 403 }
    );
  }

  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = postBodySchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid request payload", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const pf = await getPortfolioByIdForSessionUser({
    userId: session.userId,
    tenantId: session.tenantId,
    portfolioId
  });
  const portfolioName = pf?.name?.trim() ? pf.name.trim().slice(0, 120) : undefined;

  const activeBefore = await listActivePortfolioPriceAlertsForUser({
    userId: session.userId,
    tenantId: session.tenantId
  });
  const symUpper = parsed.data.symbol.trim().toUpperCase();
  const hadSymbol = activeBefore.some((a) => a.symbolNorm === symUpper);
  if (!hadSymbol && activeBefore.length >= MAX_NL_USER_PRICE_ALERT_RULES) {
    return NextResponse.json(
      { error: "Maximum active price alert rules reached.", code: "nl_price_alert_rule_cap", max: MAX_NL_USER_PRICE_ALERT_RULES },
      { status: 400 }
    );
  }

  const tenantBefore = session.tenantId ? await countActivePortfolioPriceAlertsForTenant(session.tenantId) : 0;

  const { doc, replaced } = await upsertActivePortfolioPriceAlert({
    userId: session.userId,
    tenantId: session.tenantId,
    portfolioIdHex: portfolioId,
    portfolioName,
    symbolUpper: symUpper,
    targetPriceUsd: parsed.data.targetPriceUsd,
    ruleKind: parsed.data.ruleKind,
    preserveLastReference: true
  });

  if (!doc?._id) {
    return NextResponse.json({ error: "Could not save price alert" }, { status: 400 });
  }

  if (session.tenantId) {
    const tenantAfter = await countActivePortfolioPriceAlertsForTenant(session.tenantId);
    if (tenantBefore === 0 && tenantAfter > 0) {
      await ensureUserAlertManagerScheduledTaskForTenant(session.tenantId);
    }
  }

  void createAuditEvent({
    entityType: "portfolio_price_alert",
    entityId: doc._id.toHexString(),
    action: "portfolio_price_alert_upsert_ui",
    actor: { userId: session.userId },
    details: {
      symbol: symUpper,
      targetPriceUsd: parsed.data.targetPriceUsd,
      ruleKind: parsed.data.ruleKind,
      portfolioId,
      replaced
    }
  }).catch(() => {});

  return NextResponse.json({ data: serializePriceAlert(doc) }, { status: 201 });
}
