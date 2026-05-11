import { getDb } from "@/lib/mongodb";
import type { Position, ScheduledTask } from "@/modules/core-admin/types";
import { normalizePositionType } from "@/modules/core-admin/types";
import type { ScheduledCategoryResult } from "@/modules/scanner/core-scanner-service";
import {
    countTenantPortfolios,
    fetchRawYahooQuotesWithCircuit,
    loadEquitySymbolsForTenant,
    loadStockPositionsWithQty,
    quotesForSymbolsWithCircuit,
    tenantScopeFilter
} from "@/modules/scanner/phase3-scanner-shared";
import { warmOptionChainsForEquitySymbols } from "@/modules/scanner/scanner-watchlist-chain-warm";
import { fetchYahooOptionChainForScanner } from "@/modules/scanner/yahoo-option-chain-scanner";
import { daysToExpirationFromYmd } from "@/modules/strategy-options/options-scanner-engine";
import { buildMergedOptionScanTargets, executeOptionsExpirationRollJob } from "@/modules/strategy-options/options-strategy-scanner-job";

const POSITION_COLLECTION = "portfolio_positions";

function earningsHint(row: Record<string, unknown>): string | null {
  const ts = row.earningsTimestamp;
  if (typeof ts === "number" && ts > 1e9) {
    const d = new Date(ts * 1000);
    return d.toISOString().slice(0, 10);
  }
  return null;
}

function exDivHint(row: Record<string, unknown>): string | null {
  const ts = row.exDividendDate ?? row.dividendDate;
  if (ts instanceof Date) {
    return ts.toISOString().slice(0, 10);
  }
  if (typeof ts === "number" && ts > 1e9) {
    return new Date(ts * 1000).toISOString().slice(0, 10);
  }
  return null;
}

/** Corporate events — earnings / ex-div hints from Yahoo quotes (holdings + watchlist equities). */
export async function runCorporateEventsScanner(task: ScheduledTask): Promise<ScheduledCategoryResult> {
  const tenantId = task.tenantId;
  const syms = await loadEquitySymbolsForTenant(tenantId, 80);
  const { portfolioCount, accountCount } = await countTenantPortfolios(tenantId);
  if (syms.length === 0) {
    return {
      status: "success",
      output: `corporate_events_scanner: symbols=0 portfolios=${portfolioCount} accounts=${accountCount} earnings_upcoming=0 ex_div_soon=0`
    };
  }
  const { rows, circuitOpen } = await fetchRawYahooQuotesWithCircuit(tenantId, syms.slice(0, 60));
  let earningsUp = 0;
  let exDivSoon = 0;
  const now = Date.now();
  const sevenDays = 7 * 86400000;
  for (const row of rows) {
    const sym = typeof row.symbol === "string" ? row.symbol.toUpperCase() : "";
    if (!sym) {
      continue;
    }
    const ed = earningsHint(row);
    if (ed) {
      const t = Date.parse(`${ed}T12:00:00Z`);
      if (!Number.isNaN(t) && t >= now && t - now <= sevenDays * 4) {
        earningsUp += 1;
      }
    }
    const xd = exDivHint(row);
    if (xd) {
      const t = Date.parse(`${xd}T12:00:00Z`);
      if (!Number.isNaN(t) && t >= now && t - now <= sevenDays) {
        exDivSoon += 1;
      }
    }
  }
  const c = circuitOpen ? " circuit_open=true" : "";
  const warm = await warmOptionChainsForEquitySymbols({ tenantId, symbols: syms });
  const warmNote =
    warm.attempted > 0 ? ` chain_warm=${warm.warmed}/${warm.attempted}` : "";
  return {
    status: "success",
    output: `corporate_events_scanner: symbols=${syms.length} quoted=${rows.length} earnings_flags=${earningsUp} ex_div_next_week=${exDivSoon} portfolios=${portfolioCount}${c}${warmNote}`
  };
}

/** Herfindahl on equity weights + max single-name weight. */
export async function runRiskConcentrationScanner(task: ScheduledTask): Promise<ScheduledCategoryResult> {
  const tenantId = task.tenantId;
  const positions = await loadStockPositionsWithQty(tenantId);
  const { portfolioCount, accountCount } = await countTenantPortfolios(tenantId);
  if (positions.length === 0) {
    return {
      status: "success",
      output: `risk_concentration_scanner: positions=0 hhi=0 portfolios=${portfolioCount} accounts=${accountCount}`
    };
  }
  const syms = [...new Set(positions.map((p) => p.symbol))];
  const { quoteBySymbol, circuitOpen } = await quotesForSymbolsWithCircuit(tenantId, syms);
  let totalMv = 0;
  const mvBySym = new Map<string, number>();
  for (const p of positions) {
    const px = quoteBySymbol.get(p.symbol);
    if (px === undefined) {
      continue;
    }
    const mv = Math.abs(p.qty) * px;
    totalMv += mv;
    mvBySym.set(p.symbol, (mvBySym.get(p.symbol) ?? 0) + mv);
  }
  if (totalMv <= 0) {
    const c = circuitOpen ? " circuit_open=true" : "";
    return {
      status: "success",
      output: `risk_concentration_scanner: total_mv_unavailable positions=${positions.length}${c}`
    };
  }
  let hhi = 0;
  let maxW = 0;
  let maxSym = "";
  for (const [s, mv] of mvBySym) {
    const w = mv / totalMv;
    hhi += w * w;
    if (w > maxW) {
      maxW = w;
      maxSym = s;
    }
  }
  const recon = hhi > 0.18 || maxW > 0.25 ? "review" : "ok";
  const c = circuitOpen ? " circuit_open=true" : "";
  return {
    status: "success",
    output: `risk_concentration_scanner: hhi=${hhi.toFixed(3)} max_weight=${(maxW * 100).toFixed(1)}% symbol=${maxSym || "—"} equities=${mvBySym.size} total_mv≈${totalMv.toFixed(0)} recon=${recon} portfolios=${portfolioCount}${c}`
  };
}

/** Max drift vs equal-weight across equity book (fraction of NAV). */
export async function runRebalanceScanner(task: ScheduledTask): Promise<ScheduledCategoryResult> {
  const tenantId = task.tenantId;
  const positions = await loadStockPositionsWithQty(tenantId);
  const { portfolioCount, accountCount } = await countTenantPortfolios(tenantId);
  if (positions.length === 0) {
    return {
      status: "success",
      output: `rebalance_scanner: positions=0 max_drift_pct=0 portfolios=${portfolioCount} accounts=${accountCount}`
    };
  }
  const syms = [...new Set(positions.map((p) => p.symbol))];
  const n = syms.length;
  const target = n > 0 ? 1 / n : 0;
  const { quoteBySymbol, circuitOpen } = await quotesForSymbolsWithCircuit(tenantId, syms);
  const mvBySym = new Map<string, number>();
  let totalMv = 0;
  for (const p of positions) {
    const px = quoteBySymbol.get(p.symbol);
    if (px === undefined) {
      continue;
    }
    const mv = Math.abs(p.qty) * px;
    totalMv += mv;
    mvBySym.set(p.symbol, (mvBySym.get(p.symbol) ?? 0) + mv);
  }
  if (totalMv <= 0 || n === 0) {
    const c = circuitOpen ? " circuit_open=true" : "";
    return {
      status: "success",
      output: `rebalance_scanner: drift_unavailable quotes=${quoteBySymbol.size}${c}`
    };
  }
  let maxDrift = 0;
  let worst = "";
  for (const [s, mv] of mvBySym) {
    const w = mv / totalMv;
    const drift = Math.abs(w - target) / target;
    if (drift > maxDrift) {
      maxDrift = drift;
      worst = s;
    }
  }
  const c = circuitOpen ? " circuit_open=true" : "";
  return {
    status: "success",
    output: `rebalance_scanner: names=${n} max_drift_pct=${(maxDrift * 100).toFixed(1)} worst=${worst || "—"} target_equal=${(100 / n).toFixed(1)}%_each portfolios=${portfolioCount} accounts=${accountCount}${c}`
  };
}

const LOSS_MIN_USD = 250;

/** Unrealized loss vs cost on stock lots (rough). */
export async function runTaxLossHarvestScanner(task: ScheduledTask): Promise<ScheduledCategoryResult> {
  const tenantId = task.tenantId;
  const positions = await loadStockPositionsWithQty(tenantId);
  const { portfolioCount, accountCount } = await countTenantPortfolios(tenantId);
  if (positions.length === 0) {
    return {
      status: "success",
      output: `tax_loss_harvest_scanner: candidates=0 portfolios=${portfolioCount} accounts=${accountCount}`
    };
  }
  const syms = [...new Set(positions.map((p) => p.symbol))];
  const { quoteBySymbol, circuitOpen } = await quotesForSymbolsWithCircuit(tenantId, syms);
  let candidates = 0;
  let worstLoss = 0;
  let worstSym = "";
  for (const p of positions) {
    if (p.qty <= 0) {
      continue;
    }
    const px = quoteBySymbol.get(p.symbol);
    if (px === undefined) {
      continue;
    }
    const pnl = (px - p.avgCost) * p.qty;
    if (pnl < -LOSS_MIN_USD) {
      candidates += 1;
      if (pnl < worstLoss) {
        worstLoss = pnl;
        worstSym = p.symbol;
      }
    }
  }
  const c = circuitOpen ? " circuit_open=true" : "";
  return {
    status: "success",
    output: `tax_loss_harvest_scanner: loss_candidates=${candidates} min_loss_usd=${LOSS_MIN_USD} worst=${worstSym} pnl≈${worstLoss.toFixed(0)} portfolios=${portfolioCount}${c}`
  };
}

/** Options premium + one chain sample (cache exercise) for income narrative. */
export async function runIncomeCashFlowProjector(task: ScheduledTask): Promise<ScheduledCategoryResult> {
  const tenantId = task.tenantId;
  const { portfolioCount, accountCount } = await countTenantPortfolios(tenantId);
  const built = await buildMergedOptionScanTargets({ tenantId });
  const db = await getDb();
  const scope = tenantScopeFilter(tenantId);
  const optRows = await db
    .collection<Position>(POSITION_COLLECTION)
    .find(scope)
    .limit(220)
    .toArray();

  let shortOptionLegs = 0;
  let longOptionLegs = 0;
  let creditNotional = 0;
  for (const r of optRows) {
    if (normalizePositionType(r.type) !== "option") {
      continue;
    }
    const qty = typeof r.qty === "number" && Number.isFinite(r.qty) ? r.qty : 0;
    const avg = typeof r.avgCost === "number" && Number.isFinite(r.avgCost) ? r.avgCost : 0;
    if (qty < 0) {
      shortOptionLegs += 1;
      creditNotional += Math.abs(qty) * 100 * Math.abs(avg);
    } else if (qty > 0) {
      longOptionLegs += 1;
    }
  }

  const sample = built.merged[0];
  let chainSample = "none";
  if (sample?.underlying && sample?.expYmd) {
    const dte = Math.max(1, daysToExpirationFromYmd(sample.expYmd));
    const sp = sample.strike ?? 100;
    const chain = await fetchYahooOptionChainForScanner(
      { tenantId },
      sample.underlying,
      sample.expYmd,
      sp,
      dte
    );
    chainSample =
      chain && chain.optionChain.length > 0 ? `chain_strikes=${chain.optionChain.length}` : "chain_empty";
  }

  return {
    status: "success",
    output: `income_cash_flow_projector: option_targets=${built.merged.length} short_legs=${shortOptionLegs} long_legs=${longOptionLegs} est_credit_notional≈${creditNotional.toFixed(0)} sample=${chainSample} portfolios=${portfolioCount} accounts=${accountCount}`
  };
}

/** Delegates to `executeOptionsExpirationRollJob` (shared targets + option chain cache). */
export async function runOptionsExpirationRollManager(
  task: ScheduledTask,
  runOptions?: { bypassMarketWindow?: boolean }
): Promise<ScheduledCategoryResult> {
  return executeOptionsExpirationRollJob({
    tenantId: task.tenantId,
    bypassMarketWindow: runOptions?.bypassMarketWindow
  });
}
