import { ObjectId } from "mongodb";

import { getDb } from "@/lib/mongodb";
import { chatWithXai } from "@/lib/xai";
import {
    adminCreatePortfolioAlert,
    adminCreateRecommendationForPortfolio,
    adminListPortfolioAlerts,
    adminUpdatePortfolioAlert,
    adminUpdateRecommendationForPortfolio
} from "@/modules/core-admin/repository";
import type { PortfolioAlert, PositionOptionType } from "@/modules/core-admin/types";
import { quoteUnderlyingForScanner } from "@/modules/scanner/scanner-yahoo-quote";
import { fetchYahooOptionChainForScanner } from "@/modules/scanner/yahoo-option-chain-scanner";
import type { OptionContractData } from "@/modules/strategy-options/options-chain";
import type { OptionScanTarget, OptionSide } from "@/modules/strategy-options/options-scanner-targets";
import { contractKeyForTarget } from "@/modules/strategy-options/options-scanner-targets";

const REC_COLL = "portfolio_recommendations";

const MIN_OI_WARN = 25;
const MIN_VOL_WARN = 5;

export type CloseKind = "BUY_TO_CLOSE" | "SELL_TO_CLOSE";

export type ScannerRankedSignal = {
  underlying: string;
  confidence: number;
  action: "hold" | "sell";
  source: "position" | "watchlist";
};

export type OptionsScannerPassResult = {
  examined: number;
  stored: number;
  updated: number;
  alertsCreated: number;
  alertsSuppressedDeduped: number;
  alertsDismissedOnHold: number;
  chainFailures: number;
  grokCalls: number;
  skippedBadRow: number;
  fromPositions: number;
  fromWatchlist: number;
  /** Unique underlying|expiration chain batches processed (after target grouping). */
  chainBatches: number;
  /** Desk rule/Grok confidence, highest first (trimmed for task output / audit). */
  rankedSignals: ScannerRankedSignal[];
};

function scannerEnv() {
  const grok =
    process.env.OPTIONS_SCANNER_GROK_ENABLED === undefined ||
    process.env.OPTIONS_SCANNER_GROK_ENABLED === "true" ||
    process.env.OPTIONS_SCANNER_GROK_ENABLED === "1";
  const maxGrok = Number.parseInt(process.env.OPTIONS_SCANNER_GROK_MAX_CALLS ?? "12", 10);
  const maxAlerts = Number.parseInt(process.env.OPTIONS_SCANNER_MAX_ALERTS_PER_RUN ?? "5", 10);
  return {
    grokEnabled: grok,
    maxGrokCalls: Number.isFinite(maxGrok) && maxGrok >= 0 ? maxGrok : 12,
    maxAlertsPerRun: Number.isFinite(maxAlerts) && maxAlerts >= 0 ? maxAlerts : 5
  };
}

function utcDayStart(now: Date): Date {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function daysToExpirationFromYmd(expYmd: string): number {
  const exp = new Date(`${expYmd}T00:00:00.000Z`);
  const today = new Date();
  const t0 = Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate());
  const t1 = Date.UTC(exp.getUTCFullYear(), exp.getUTCMonth(), exp.getUTCDate());
  return Math.max(0, Math.ceil((t1 - t0) / 86400000));
}

function strikeMatch(a: number, b: number): boolean {
  return Math.abs(a - b) < 0.02;
}

function findContractAtStrike(
  chain: { strike: number; call: OptionContractData | null; put: OptionContractData | null }[],
  strike: number,
  ot: PositionOptionType
): OptionContractData | null {
  const row = chain.find((r) => strikeMatch(r.strike, strike));
  if (!row) {
    return null;
  }
  return ot === "call" ? row.call : row.put;
}

export type RuleDecision = {
  /** Recommend closing / rolling the leg (maps to BUY_TO_CLOSE or SELL_TO_CLOSE by side). */
  action: "hold" | "sell";
  rationale: string;
  confidence: number;
  needsGrok: boolean;
  pnlPct: number | null;
};

/**
 * Long: mark vs premium paid. Short: credit vs mark (profit when mark falls vs credit).
 * High-IV short puts: tighter loss cut (conservative).
 */
export function decideOptionActionFromRules(input: {
  dte: number;
  mark: number;
  avgCost: number;
  openInterest: number;
  volume: number;
  side: OptionSide;
  impliedVolPercent: number;
  optionType: PositionOptionType;
}): RuleDecision {
  const { dte, mark, avgCost, openInterest, volume, side, impliedVolPercent, optionType } = input;
  let pnlPct: number | null = null;
  if (avgCost > 0.0001) {
    if (side === "long") {
      pnlPct = ((mark - avgCost) / avgCost) * 100;
    } else {
      pnlPct = ((avgCost - mark) / avgCost) * 100;
    }
  }

  const shortPutHighIv = side === "short" && optionType === "put" && impliedVolPercent >= 70;
  const lossCut = shortPutHighIv ? -40 : -55;
  const profitTake = shortPutHighIv ? 70 : 85;

  if (dte <= 0) {
    return {
      action: "sell",
      rationale: "Contract at or past expiration — close or roll if still open.",
      confidence: 95,
      needsGrok: false,
      pnlPct
    };
  }
  if (dte <= 3) {
    return {
      action: "sell",
      rationale: "Very short DTE; theta and pin risk dominate — consider closing or rolling.",
      confidence: 78,
      needsGrok: false,
      pnlPct
    };
  }
  if (pnlPct !== null && pnlPct >= profitTake) {
    return {
      action: "sell",
      rationale: `Favorable P/L vs entry (~${pnlPct.toFixed(0)}%) — consider taking profit / closing.`,
      confidence: 82,
      needsGrok: false,
      pnlPct
    };
  }
  if (pnlPct !== null && pnlPct <= lossCut) {
    return {
      action: "sell",
      rationale: `Adverse move vs entry (~${pnlPct.toFixed(0)}%) — review risk; consider cutting, rolling, or hedging.${
        shortPutHighIv ? " (High IV short put — conservative threshold.)" : ""
      }`,
      confidence: shortPutHighIv ? 78 : 72,
      needsGrok: true,
      pnlPct
    };
  }
  if (openInterest < MIN_OI_WARN && volume < MIN_VOL_WARN) {
    return {
      action: "hold",
      rationale: `Thin OI (${openInterest}) and volume (${volume}) — liquidity risk; size exits carefully.`,
      confidence: 55,
      needsGrok: true,
      pnlPct
    };
  }
  if (dte <= 7 && pnlPct !== null && pnlPct > 35) {
    return {
      action: "hold",
      rationale: "Short dated with solid P/L — watch assignment / gamma into expiry.",
      confidence: 62,
      needsGrok: true,
      pnlPct
    };
  }
  return {
    action: "hold",
    rationale: "No immediate rule-based exit: leg within typical parameters vs mark and DTE.",
    confidence: 68,
    needsGrok: false,
    pnlPct
  };
}

function closeKindForSide(side: OptionSide): CloseKind {
  return side === "long" ? "BUY_TO_CLOSE" : "SELL_TO_CLOSE";
}

function mapExitToRecommendationAction(
  exit: boolean,
  side: OptionSide
): "buy" | "sell" | "hold" {
  if (!exit) {
    return "hold";
  }
  return side === "long" ? "sell" : "buy";
}

async function grokRefineDecision(input: {
  underlying: string;
  expYmd: string;
  strike: number;
  optionType: PositionOptionType;
  side: OptionSide;
  stockPrice: number;
  mark: number;
  avgCost: number;
  dte: number;
  oi: number;
  vol: number;
  rule: RuleDecision;
}): Promise<{ rationale: string; action: "hold" | "sell"; confidence: number } | null> {
  const sys =
    "You are a concise options desk assistant. Side long means you paid premium; short means you collected premium. Reply with JSON only, no markdown: {\"action\":\"hold\"|\"sell\",\"rationale\":\"max 500 chars\",\"confidence\":0-100}. action sell means recommend closing the position (buy to close if short premium, sell to close if long). Educational only; not financial advice.";
  const user = JSON.stringify({
    underlying: input.underlying,
    side: input.side,
    contract: `${input.expYmd} ${input.strike}${input.optionType === "call" ? "C" : "P"}`,
    stockPrice: input.stockPrice,
    mark: input.mark,
    avgCost: input.avgCost,
    dte: input.dte,
    openInterest: input.oi,
    volume: input.vol,
    ruleSuggestion: {
      action: input.rule.action,
      rationale: input.rule.rationale,
      confidence: input.rule.confidence,
      pnlPct: input.rule.pnlPct
    }
  });
  try {
    const out = await chatWithXai({
      messages: [
        { role: "system", content: sys },
        { role: "user", content: user }
      ],
      temperature: 0.15
    });
    const text = out.outputText.trim();
    const cleaned = text.replace(/^```json\s*|\s*```$/g, "");
    const json = JSON.parse(cleaned) as {
      action?: string;
      rationale?: string;
      confidence?: number;
    };
    const action = json.action === "sell" ? "sell" : "hold";
    const rationale =
      typeof json.rationale === "string" && json.rationale.trim().length > 0
        ? json.rationale.trim().slice(0, 520)
        : input.rule.rationale;
    const confidence =
      typeof json.confidence === "number" && Number.isFinite(json.confidence)
        ? Math.min(100, Math.max(0, Math.round(json.confidence)))
        : input.rule.confidence;
    return { action, rationale, confidence };
  } catch {
    return null;
  }
}

function buildScannerNote(input: {
  underlying: string;
  displayExp: string;
  strike: number;
  optionType: PositionOptionType;
  side: OptionSide;
  fingerprint: string;
  mark: number;
  dte: number;
  oi: number;
  vol: number;
  iv: number;
  desk: RuleDecision;
  exit: boolean;
  finalRationale: string;
  finalConfidence: number;
  grokLine: string | null;
  source: "position" | "watchlist";
  closeKind: CloseKind | null;
}): string {
  const ot = input.optionType === "call" ? "C" : "P";
  const grok = input.grokLine ? `\nGrok: ${input.grokLine}` : "";
  const ck = input.closeKind ? `\nClose: ${input.closeKind}` : "";
  const raw = `[options-scanner] fp:${input.fingerprint}
Source: ${input.source} · Side: ${input.side.toUpperCase()}
Contract: ${input.underlying} ${input.displayExp} ${input.strike}${ot} · mark $${input.mark.toFixed(2)} · DTE ${input.dte} · OI ${input.oi} · vol ${input.vol} · IV ${input.iv.toFixed(1)}%
Desk: ${input.desk.action.toUpperCase()} (${input.desk.confidence}%) — ${input.desk.rationale}
Effective: ${input.exit ? "EXIT" : "HOLD"} (${input.finalConfidence}%) — ${input.finalRationale}${ck}${grok}
Disclaimer: Not financial advice.`;
  return raw.length <= 4000 ? raw : raw.slice(0, 3997) + "...";
}

async function findTodayScannerRec(
  portfolioOid: ObjectId,
  fingerprint: string
): Promise<{ _id?: ObjectId } | null> {
  const db = await getDb();
  const since = utcDayStart(new Date());
  const rx = new RegExp(`\\[options-scanner\\][\\s\\S]*fp:${escapeRegex(fingerprint)}`);
  return db.collection(REC_COLL).findOne({
    portfolioId: portfolioOid,
    createdAt: { $gte: since },
    note: { $regex: rx }
  });
}

function hasActiveCloseAlert(
  alerts: PortfolioAlert[],
  contractKey: string,
  closeKind: CloseKind
): boolean {
  const tag = `[afp:${contractKey}]`;
  const closeTag = `[close:${closeKind}]`;
  return alerts.some(
    (a) => a.status === "active" && a.body?.includes(tag) && a.body?.includes(closeTag)
  );
}

async function dismissScannerAlertsForContract(
  portfolioId: string,
  contractKey: string
): Promise<number> {
  const alerts = await adminListPortfolioAlerts(portfolioId);
  let dismissed = 0;
  for (const a of alerts) {
    if (a.status !== "active" || !a.body?.includes(`[afp:${contractKey}]`) || !a._id) {
      continue;
    }
    const u = await adminUpdatePortfolioAlert({
      portfolioId,
      alertId: a._id.toHexString(),
      patch: { status: "dismissed" }
    });
    if (u) {
      dismissed += 1;
    }
  }
  return dismissed;
}

/**
 * Positions + watchlist option rows: Yahoo chain, side-aware rules, Grok optional,
 * `portfolio_recommendations`, deduped close alerts.
 */
export async function processOptionRecommendationsPass(input: {
  targets: OptionScanTarget[];
  /** Tenant scope for option-chain cache + Yahoo circuit breaker (scheduled scanners). */
  tenantId?: ObjectId;
}): Promise<OptionsScannerPassResult> {
  const env = scannerEnv();
  const result: OptionsScannerPassResult = {
    examined: 0,
    stored: 0,
    updated: 0,
    alertsCreated: 0,
    alertsSuppressedDeduped: 0,
    alertsDismissedOnHold: 0,
    chainFailures: 0,
    grokCalls: 0,
    skippedBadRow: 0,
    fromPositions: 0,
    fromWatchlist: 0,
    chainBatches: 0,
    rankedSignals: []
  };
  const rankedBuffer: ScannerRankedSignal[] = [];

  let grokBudget = env.maxGrokCalls;
  let alertsBudget = env.maxAlertsPerRun;
  const alertCache = new Map<string, PortfolioAlert[]>();

  async function alertsFor(portfolioId: string): Promise<PortfolioAlert[]> {
    if (!alertCache.has(portfolioId)) {
      alertCache.set(portfolioId, await adminListPortfolioAlerts(portfolioId));
    }
    return alertCache.get(portfolioId)!;
  }
  function invalidateAlerts(portfolioId: string) {
    alertCache.delete(portfolioId);
  }

  const valid = input.targets.filter((t) => {
    if (!t.portfolioId || !t.underlying || !t.expYmd) {
      result.skippedBadRow += 1;
      return false;
    }
    return true;
  });

  for (const t of valid) {
    if (t.source === "position") {
      result.fromPositions += 1;
    } else {
      result.fromWatchlist += 1;
    }
  }

  const groups = new Map<string, OptionScanTarget[]>();
  for (const t of valid) {
    const key = `${t.underlying}|${t.expYmd}`;
    const list = groups.get(key) ?? [];
    list.push(t);
    groups.set(key, list);
  }

  result.chainBatches = groups.size;

  for (const [, group] of groups) {
    const sample = group[0]!;
    const underlying = sample.underlying;
    const expYmd = sample.expYmd;
    let stockPrice = sample.strike ?? 100;
    const q = await quoteUnderlyingForScanner(input.tenantId, underlying);
    if (!q) {
      result.chainFailures += group.length;
      continue;
    }
    stockPrice = q.regularMarketPrice ?? q.postMarketPrice ?? stockPrice;

    const dteRough = Math.max(1, daysToExpirationFromYmd(expYmd));
    const chainResult = await fetchYahooOptionChainForScanner(
      { tenantId: input.tenantId },
      underlying,
      expYmd,
      stockPrice,
      dteRough
    );
    if (!chainResult?.optionChain?.length) {
      result.chainFailures += group.length;
      continue;
    }

    const displayExp = chainResult.actualExpiration ?? expYmd;
    await new Promise((r) => setTimeout(r, 120));

    for (const tgt of group) {
      result.examined += 1;
      const strike = tgt.strike;
      const ot = tgt.optionType;
      const side = tgt.side;
      const contract = findContractAtStrike(chainResult.optionChain, strike, ot);
      if (!contract) {
        result.chainFailures += 1;
        continue;
      }

      const mark =
        contract.last_quote.bid > 0 && contract.last_quote.ask > 0
          ? (contract.last_quote.bid + contract.last_quote.ask) / 2
          : contract.premium;
      const avgCost = tgt.avgCost;
      const fp = `${displayExp}:${strike}:${ot}:${side}:${tgt.source}`;
      const dte = daysToExpirationFromYmd(displayExp);
      const iv = contract.implied_volatility;

      const rule = decideOptionActionFromRules({
        dte,
        mark,
        avgCost,
        openInterest: contract.open_interest,
        volume: contract.volume,
        side,
        impliedVolPercent: iv,
        optionType: ot
      });

      const ambiguousPnl =
        rule.pnlPct !== null && Math.abs(rule.pnlPct) >= 35 && Math.abs(rule.pnlPct) <= 95;
      const wantGrok =
        env.grokEnabled && grokBudget > 0 && (rule.needsGrok || ambiguousPnl);

      let grokOut: Awaited<ReturnType<typeof grokRefineDecision>> | null = null;
      if (wantGrok) {
        grokOut = await grokRefineDecision({
          underlying,
          expYmd: displayExp,
          strike,
          optionType: ot,
          side,
          stockPrice,
          mark,
          avgCost,
          dte,
          oi: contract.open_interest,
          vol: contract.volume,
          rule
        });
        if (grokOut) {
          grokBudget -= 1;
          result.grokCalls += 1;
        }
      }

      const exit = (grokOut?.action ?? rule.action) === "sell";
      const finalConf = grokOut?.confidence ?? rule.confidence;
      rankedBuffer.push({
        underlying,
        confidence: finalConf,
        action: exit ? "sell" : "hold",
        source: tgt.source
      });
      const finalRationale =
        grokOut?.rationale && grokOut.rationale.length > 0 ? grokOut.rationale : rule.rationale;
      const grokLine =
        grokOut && grokOut.rationale
          ? `${grokOut.rationale.slice(0, 280)} (${grokOut.action}, ${grokOut.confidence}%)`
          : null;

      const closeKind: CloseKind | null = exit ? closeKindForSide(side) : null;
      const contractKey = contractKeyForTarget(tgt);

      const note = buildScannerNote({
        underlying,
        displayExp,
        strike,
        optionType: ot,
        side,
        fingerprint: fp,
        mark,
        dte,
        oi: contract.open_interest,
        vol: contract.volume,
        iv,
        desk: rule,
        exit,
        finalRationale,
        finalConfidence: finalConf,
        grokLine,
        source: tgt.source,
        closeKind
      });

      const portfolioId = tgt.portfolioId.toHexString();
      const existing = await findTodayScannerRec(tgt.portfolioId, fp);
      const recAction = mapExitToRecommendationAction(exit, side);

      if (existing?._id) {
        const updated = await adminUpdateRecommendationForPortfolio({
          portfolioId,
          id: existing._id.toHexString(),
          patch: { action: recAction, note }
        });
        if (updated) {
          result.updated += 1;
        }
      } else {
        const created = await adminCreateRecommendationForPortfolio({
          portfolioId,
          symbol: underlying.slice(0, 32),
          action: recAction,
          note,
          accountId: tgt.accountId?.toHexString(),
          quantity: tgt.qty,
          targetPrice: mark > 0 ? Number(mark.toFixed(4)) : undefined
        });
        if (created) {
          result.stored += 1;
        }
      }

      const palerts = await alertsFor(portfolioId);

      if (!exit) {
        const d = await dismissScannerAlertsForContract(portfolioId, contractKey);
        result.alertsDismissedOnHold += d;
        if (d > 0) {
          invalidateAlerts(portfolioId);
        }
        continue;
      }

      if (closeKind && alertsBudget > 0) {
        if (hasActiveCloseAlert(palerts, contractKey, closeKind)) {
          result.alertsSuppressedDeduped += 1;
          continue;
        }
        const title =
          closeKind === "BUY_TO_CLOSE"
            ? `Option scanner: BUY_TO_CLOSE ${underlying} ${displayExp} ${strike}${ot === "call" ? "C" : "P"}`
            : `Option scanner: SELL_TO_CLOSE ${underlying} ${displayExp} ${strike}${ot === "call" ? "C" : "P"}`;
        const body = `[afp:${contractKey}]\n[close:${closeKind}]\n\n${finalRationale}`.slice(0, 4000);
        const al = await adminCreatePortfolioAlert({
          portfolioId,
          title,
          body,
          severity: "warning",
          symbol: underlying.slice(0, 32)
        });
        if (al) {
          result.alertsCreated += 1;
          alertsBudget -= 1;
          invalidateAlerts(portfolioId);
        }
      }
    }
  }

  result.rankedSignals = rankedBuffer.sort((a, b) => b.confidence - a.confidence).slice(0, 12);

  return result;
}
