import { daysToExpirationUtc } from "@/lib/xoptions/xoptions-order-preview";
import type { XoptionsRiskAlert, XoptionsRiskAlertSeverity } from "@/lib/xoptions/xoptions-review-types";

export type RiskAlertServiceInput = {
  symbol: string;
  side: "call" | "put";
  openingAction: "buy_to_open" | "sell_to_open";
  expirationYyyyMmDd: string;
  impliedVolatilityPercent: number | null | undefined;
  probabilityOtmPercent: number | null;
  earningsDateIso: string | null;
};

function clampIvRankPercent(ivPercent: number): number {
  return Math.min(99, Math.max(1, ((ivPercent - 15) / 55) * 100));
}

function alert(
  id: string,
  severity: XoptionsRiskAlertSeverity,
  title: string,
  plainEnglish: string,
  tooltipDefinition: string,
  metricKey?: string
): XoptionsRiskAlert {
  return { id, severity, title, plainEnglish, tooltipDefinition, metricKey };
}

export function buildXoptionsRiskAlerts(input: RiskAlertServiceInput): XoptionsRiskAlert[] {
  const alerts: XoptionsRiskAlert[] = [];
  const sym = input.symbol.trim().toUpperCase();
  const dte = daysToExpirationUtc(input.expirationYyyyMmDd);

  if (dte <= 7) {
    alerts.push(
      alert(
        "dte_short",
        "warning",
        "Very short dated",
        `Short-dated theta decay is elevated — about ${dte} day${dte === 1 ? "" : "s"} to expiration, so premium and assignment risk can move quickly.`,
        "Days to expiration (DTE) is the calendar days left before the option expires.",
        "dte"
      )
    );
  } else if (dte <= 21) {
    alerts.push(
      alert(
        "dte_medium",
        "caution",
        "Short dated window",
        `About ${dte} days remain before expiration, so premium and delta can change faster than longer-dated trades.`,
        "Days to expiration (DTE) is the calendar days left before the option expires.",
        "dte"
      )
    );
  }

  if (input.impliedVolatilityPercent != null && Number.isFinite(input.impliedVolatilityPercent)) {
    const ivRank = clampIvRankPercent(input.impliedVolatilityPercent);
    if (ivRank >= 75) {
      alerts.push(
        alert(
          "iv_rank_high",
          "caution",
          "Elevated implied volatility",
          `Elevated implied volatility — premium may be rich, but mark-to-market swings and gap risk can be larger than in low-IV regimes.`,
          "IV rank is a simplified percentile-style read of implied volatility versus a fixed desk range.",
          "iv_rank"
        )
      );
    } else if (ivRank <= 25) {
      alerts.push(
        alert(
          "iv_rank_low",
          "info",
          "Lower implied volatility",
          `Implied volatility looks relatively low, so premium may be thinner than in higher-volatility regimes.`,
          "IV rank is a simplified percentile-style read of implied volatility versus a fixed desk range.",
          "iv_rank"
        )
      );
    }
  }

  if (input.openingAction === "sell_to_open" && input.probabilityOtmPercent != null) {
    const assignmentPct = Math.min(100, Math.max(0, 100 - input.probabilityOtmPercent));
    if (assignmentPct >= 35) {
      alerts.push(
        alert(
          "assignment_elevated",
          "warning",
          "Higher assignment risk",
          `Higher assignment risk — ${assignmentPct}% odds of finishing in the money; monitor for early exercise and consider rolling if assigned.`,
          "Assignment probability here is approximated as 100% minus the estimated probability of expiring out of the money.",
          "assignment_probability"
        )
      );
    } else if (assignmentPct >= 20) {
      alerts.push(
        alert(
          "assignment_moderate",
          "caution",
          "Assignment risk to watch",
          `Moderate assignment risk — roughly ${assignmentPct}% odds of finishing in the money; plan liquidity before expiration week.`,
          "Assignment probability here is approximated as 100% minus the estimated probability of expiring out of the money.",
          "assignment_probability"
        )
      );
    }
  }

  if (input.earningsDateIso) {
    const earningsMs = new Date(input.earningsDateIso).getTime();
    const expMs = new Date(`${input.expirationYyyyMmDd.slice(0, 10)}T23:59:59.000Z`).getTime();
    if (Number.isFinite(earningsMs) && Number.isFinite(expMs)) {
      const daysToEarnings = Math.ceil((earningsMs - Date.now()) / (24 * 60 * 60 * 1000));
      const earningsBeforeExpiry = earningsMs <= expMs;
      if (earningsBeforeExpiry && daysToEarnings >= 0 && daysToEarnings <= 14) {
        alerts.push(
          alert(
            "earnings_before_expiry",
            "warning",
            "Earnings before expiration",
            `${sym} reports in about ${daysToEarnings} day${daysToEarnings === 1 ? "" : "s"} while this contract is still live, so gap risk can jump.`,
            "Earnings proximity flags when a scheduled earnings date falls before the option expires.",
            "earnings_proximity"
          )
        );
      }
    }
  }

  return alerts;
}
