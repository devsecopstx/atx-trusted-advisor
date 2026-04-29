import type { WorkspaceDashboardAccountSlice } from "@/lib/workspace-dashboard-metrics";
import { DESK_OUTLOOK_LABELS, DESK_RISK_DISPLAY_LABELS } from "@/modules/core-admin/desk-fields";
import type { AccountOutlook } from "@/modules/core-admin/types";

type RiskKey = keyof typeof DESK_RISK_DISPLAY_LABELS;

function tallyWeights(keys: (string | null | undefined)[], weights: number[]): Map<string, number> {
  const m = new Map<string, number>();
  for (let i = 0; i < keys.length; i++) {
    const k = keys[i];
    if (k == null || k === "") {
      continue;
    }
    const w = Math.max(0, weights[i] ?? 0);
    m.set(k, (m.get(k) ?? 0) + (w > 0 ? w : 1));
  }
  return m;
}

function dominantKey(map: Map<string, number>): string | null {
  let best: string | null = null;
  let bestW = -1;
  for (const [k, w] of map) {
    if (w > bestW) {
      bestW = w;
      best = k;
    }
  }
  return best;
}

/**
 * One-line desk summary for a portfolio card: outlook + risk from linked accounts, book-weighted when values exist.
 */
export function portfolioDeskNarrativeLine(
  slices: readonly WorkspaceDashboardAccountSlice[],
  portfolioId: string
): string | null {
  const rows = slices.filter((s) => s.portfolioId === portfolioId);
  if (rows.length === 0) {
    return null;
  }

  const bookSum = rows.reduce((s, r) => s + Math.max(0, r.valueUsd), 0);
  const useEqualWeights = bookSum <= 0;
  const weights = rows.map((r) => (useEqualWeights ? 1 : Math.max(0, r.valueUsd)));

  const outlookKeys = rows.map((r) => r.outlook ?? null);
  const riskKeys = rows.map((r) => r.riskProfile ?? null);

  const om = tallyWeights(outlookKeys, weights);
  const rm = tallyWeights(riskKeys, weights);

  const domOut = dominantKey(om) as AccountOutlook | null;
  const domRisk = dominantKey(rm) as RiskKey | null;

  const outlookLabel = domOut ? DESK_OUTLOOK_LABELS[domOut] : null;
  const riskLabel = domRisk ? DESK_RISK_DISPLAY_LABELS[domRisk] : null;

  const multi = rows.length > 1;
  const weightHint = multi ? " · book-weighted across accounts" : "";

  if (outlookLabel && riskLabel) {
    return `${outlookLabel} outlook · ${riskLabel} risk${weightHint}`;
  }
  if (outlookLabel) {
    return `${outlookLabel} outlook · set risk profile on each account for a full desk read${multi ? ` (${rows.length} accounts)` : ""}`;
  }
  if (riskLabel) {
    return `${riskLabel} risk · set market outlook on each account for a full desk read${multi ? ` (${rows.length} accounts)` : ""}`;
  }

  return `Set market outlook and risk on each account (Portfolio → accounts) to see your desk summary.${multi ? ` ${rows.length} accounts linked.` : ""}`;
}
