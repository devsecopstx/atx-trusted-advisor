import { ObjectId } from "mongodb";

import { sendDeskHtmlEmailWithRetry } from "@/lib/desk-smtp";
import { buildUserPriceAlertEmailHtml, buildUserPriceAlertEmailText } from "@/lib/email/user-price-alert-email";
import { createAuditEvent } from "@/modules/audit/repository";
import {
    fireAndForgetArchiveAdvisorSystemAdvice,
    resolvePortfolioOwnerForAdviceArchive
} from "@/modules/compliance/advisor-advice-events";
import {
    adminCreatePortfolioAlert,
    adminHasRecentPriceAlertForSymbol
} from "@/modules/core-admin/repository";
import { getCoreUserById } from "@/modules/identity/repository";
import { dispatchPortfolioDeskEvents } from "@/modules/notifications/portfolio-notification-service";
import {
    listActivePortfolioPriceAlertsForTenantBySymbols,
    markPortfolioPriceAlertFired,
    patchPortfolioPriceAlertReference
} from "@/modules/price-alerts/portfolio-price-alerts-repository";
import { evaluateUserPriceRuleCross } from "@/modules/price-alerts/price-alert-cross-eval";
import { getPriceAlertCooldownMs } from "@/modules/watchlist/price-alert-service";
import { canReceiveNlPriceAlertEmail } from "@/modules/xchat/plan-limits";

export type ProcessPortfolioPriceAlertsResult = {
  evaluated: number;
  armedUpdates: number;
  fired: number;
  skippedCooldown: number;
};

function userOid(raw: string): ObjectId | null {
  return ObjectId.isValid(raw) ? new ObjectId(raw) : null;
}

function alertsAbsoluteUrl(portfolioIdHex: string): string {
  const base =
    process.env.PUBLIC_APP_BASE_URL?.trim() ||
    process.env.NEXT_PUBLIC_APP_URL?.trim() ||
    process.env.VERCEL_URL?.trim();
  const path = `/portfolio/alerts?portfolioId=${encodeURIComponent(portfolioIdHex)}`;
  if (!base) {
    return path;
  }
  if (base.startsWith("http://") || base.startsWith("https://")) {
    return `${base.replace(/\/$/, "")}${path}`;
  }
  return `https://${base.replace(/\/$/, "")}${path}`;
}

/**
 * Evaluate tenant-scoped NL price alerts against a Yahoo quote map (watchlist scanner or user_alert_manager).
 */
export async function processPortfolioPriceAlertsWithQuotes(input: {
  tenantIdHex: string;
  quotePriceBySymbolUpper: Map<string, number>;
  now?: Date;
}): Promise<ProcessPortfolioPriceAlertsResult> {
  const now = input.now ?? new Date();
  let evaluated = 0;
  let armedUpdates = 0;
  let fired = 0;
  let skippedCooldown = 0;

  const symbols = [...input.quotePriceBySymbolUpper.keys()];
  if (symbols.length === 0 || !ObjectId.isValid(input.tenantIdHex)) {
    return { evaluated, armedUpdates, fired, skippedCooldown };
  }

  const alerts = await listActivePortfolioPriceAlertsForTenantBySymbols({
    tenantIdHex: input.tenantIdHex,
    symbolNormsUpper: symbols
  });

  const cooldownMs = getPriceAlertCooldownMs();
  const since = cooldownMs > 0 ? new Date(now.getTime() - cooldownMs) : new Date(0);

  for (const alert of alerts) {
    evaluated += 1;
    const sym = alert.symbolNorm.trim().toUpperCase();
    const px = input.quotePriceBySymbolUpper.get(sym);
    if (px === undefined || !Number.isFinite(px)) {
      continue;
    }

    const evalResult = evaluateUserPriceRuleCross({
      ruleKind: alert.ruleKind,
      targetPriceUsd: alert.targetPriceUsd,
      lastReferencePrice: alert.lastReferencePrice,
      currentPrice: px
    });

    const alertId = alert._id?.toHexString();
    if (!alertId) {
      continue;
    }

    if (!evalResult.fire) {
      if (alert.lastReferencePrice !== evalResult.nextLastReference) {
        const ok = await patchPortfolioPriceAlertReference({
          alertIdHex: alertId,
          tenantIdHex: input.tenantIdHex,
          lastReferencePrice: evalResult.nextLastReference
        });
        if (ok) {
          armedUpdates += 1;
        }
      }
      continue;
    }

    const claimed = await markPortfolioPriceAlertFired({
      alertIdHex: alertId,
      tenantIdHex: input.tenantIdHex,
      firedAt: now
    });
    if (!claimed) {
      continue;
    }
    fired += 1;

    const portfolioIdHex = alert.portfolioId.toHexString();
    const title = `${sym} hit your ${alert.ruleKind} $${alert.targetPriceUsd.toFixed(2)} NL alert`;
    const body = `Quote ~$${px.toFixed(2)} vs target $${alert.targetPriceUsd.toFixed(2)} (${alert.ruleKind}).`;

    let deskSkipped = false;
    if (cooldownMs > 0) {
      const recent = await adminHasRecentPriceAlertForSymbol(portfolioIdHex, sym, since);
      if (recent) {
        skippedCooldown += 1;
        deskSkipped = true;
      }
    }

    if (!deskSkipped) {
      const deskAlert = await adminCreatePortfolioAlert({
        portfolioId: portfolioIdHex,
        title,
        body,
        severity: "info",
        status: "active",
        symbol: sym,
        accountContext: "watchlist"
      });
      if (deskAlert) {
        const owner = await resolvePortfolioOwnerForAdviceArchive(portfolioIdHex);
        if (owner) {
          fireAndForgetArchiveAdvisorSystemAdvice({
            tenantId: owner.tenantId,
            userId: owner.userId,
            surface: "portfolio_alert",
            artifactKind: "portfolio_alert",
            prompt: title,
            responseText: body,
            responsePayload: {
              alertId: deskAlert._id?.toHexString() ?? null,
              ruleKind: alert.ruleKind,
              targetPriceUsd: alert.targetPriceUsd,
              quoteUsd: px
            },
            metadata: { source: "portfolio_price_alert_rule", severity: "info" }
          });
        }
      }
      try {
        await dispatchPortfolioDeskEvents(portfolioIdHex, [{ title, body, symbol: sym }]);
      } catch (error) {
        console.warn("[price-alerts] desk dispatch failed", {
          portfolioIdPrefix: portfolioIdHex.slice(0, 8),
          symbol: sym,
          error: error instanceof Error ? error.message : String(error)
        });
      }
    }

    void createAuditEvent({
      entityType: "portfolio_price_alert",
      entityId: alertId,
      action: "nl_price_alert_triggered",
      actor: { userId: alert.userId },
      details: {
        tenantId: input.tenantIdHex,
        portfolioId: portfolioIdHex,
        symbol: sym,
        targetPriceUsd: alert.targetPriceUsd,
        ruleKind: alert.ruleKind,
        spotPrice: px,
        deskSkippedCooldown: deskSkipped
      }
    }).catch(() => {});

    const oid = userOid(alert.userId);
    if (!oid) {
      continue;
    }
    const user = await getCoreUserById(oid);
    if (!user?.email) {
      continue;
    }
    if (
      !canReceiveNlPriceAlertEmail(user.subscriptionPlan, user.roles as unknown as string[])
    ) {
      continue;
    }

    const alertsUrl = alertsAbsoluteUrl(portfolioIdHex);
    const okMail = await sendDeskHtmlEmailWithRetry({
      to: user.email,
      subject: `${sym} — xFinance price alert`,
      text: buildUserPriceAlertEmailText({
        symbol: sym,
        ruleKind: alert.ruleKind,
        targetPriceUsd: alert.targetPriceUsd,
        spotPrice: px,
        alertsUrl
      }),
      html: buildUserPriceAlertEmailHtml({
        symbol: sym,
        ruleKind: alert.ruleKind,
        targetPriceUsd: alert.targetPriceUsd,
        spotPrice: px,
        alertsUrl
      })
    });
    if (!okMail) {
      console.warn("[price-alerts] desk HTML email failed or SMTP unset", {
        userIdPrefix: alert.userId.slice(0, 8),
        symbol: sym
      });
    }
  }

  return { evaluated, armedUpdates, fired, skippedCooldown };
}
