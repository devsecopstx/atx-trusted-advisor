import type { SessionUser } from "@/lib/auth";
import { getTopStockHoldingsByValue } from "@/modules/find-options/find-options-service";
import { buildUpcomingFridayExpirations, preferFridayExpirations } from "@/modules/strategy-options/expirations";
import {
    fetchYahooOptionChainForExpiration,
    type OptionContractData
} from "@/modules/strategy-options/options-chain";
import { getYahooFinance2 } from "@/modules/yahoo/yahoo-finance-service";
import { yahooQuoteWithValidationFallback } from "@/modules/yahoo/yahoo-quote-validation-fallback";

import type {
    WheelContractLeg,
    WheelGeneratedPayload,
    WheelGeneratorInput,
    WheelIdea,
    WheelPortfolioFit,
    WheelRelatedSupplierCandidate,
    WheelRelatedSuppliers,
    WheelRiskTolerance,
    WheelUnderlyingSnapshot
} from "./wheel-types";

type ChainForDate = {
  optionChain: { strike: number; call: OptionContractData | null; put: OptionContractData | null }[];
  actualExpiration: string;
};

type LegCandidate = {
  leg: WheelContractLeg;
  assignmentProbabilityPct: number;
  callAwayProbabilityPct: number;
  syntheticDelta: number;
};

const WHEEL_DISCLAIMER =
  "Educational analysis only. Options involve risk, assignment uncertainty, liquidity constraints, and tax complexity. Not financial advice.";

const SUPPLIER_RELATIONSHIP_MAP: Record<
  string,
  Array<{ symbol: string; companyName: string; relationship: string }>
> = {
  TSLA: [
    { symbol: "NVDA", companyName: "NVIDIA", relationship: "AI compute and autonomous stack supplier" },
    { symbol: "ON", companyName: "onsemi", relationship: "Power semiconductors and image sensors" },
    { symbol: "STM", companyName: "STMicroelectronics", relationship: "Automotive microcontrollers and power modules" },
    { symbol: "ALB", companyName: "Albemarle", relationship: "Lithium supply exposure for EV batteries" },
    { symbol: "MP", companyName: "MP Materials", relationship: "Rare-earth magnet supply chain linkage" },
    { symbol: "QS", companyName: "QuantumScape", relationship: "Battery technology adjacency" },
    { symbol: "RIVN", companyName: "Rivian", relationship: "EV ecosystem demand sentiment proxy" },
    { symbol: "PCAR", companyName: "PACCAR", relationship: "Commercial EV supplier ecosystem overlap" },
    { symbol: "BWA", companyName: "BorgWarner", relationship: "eDrive and drivetrain components" },
    { symbol: "MGA", companyName: "Magna", relationship: "Contract manufacturing and components" }
  ],
  AAPL: [
    { symbol: "QCOM", companyName: "Qualcomm", relationship: "Modem and wireless chipset supplier" },
    { symbol: "AVGO", companyName: "Broadcom", relationship: "RF and connectivity semiconductor supplier" },
    { symbol: "SWKS", companyName: "Skyworks", relationship: "RF front-end supplier for mobile devices" },
    { symbol: "QRVO", companyName: "Qorvo", relationship: "RF and filter component supplier" },
    { symbol: "LRCX", companyName: "Lam Research", relationship: "Semiconductor equipment upstream linkage" },
    { symbol: "AMAT", companyName: "Applied Materials", relationship: "Semiconductor fabrication equipment exposure" },
    { symbol: "MU", companyName: "Micron", relationship: "Memory supplier ecosystem proxy" },
    { symbol: "WDC", companyName: "Western Digital", relationship: "Storage component ecosystem linkage" },
    { symbol: "TER", companyName: "Teradyne", relationship: "Chip testing supplier to mobile value chain" },
    { symbol: "CDNS", companyName: "Cadence", relationship: "EDA tooling supplier for Apple silicon ecosystem" }
  ],
  NVDA: [
    { symbol: "TSM", companyName: "TSMC", relationship: "Primary foundry for advanced GPU nodes" },
    { symbol: "ASML", companyName: "ASML", relationship: "EUV lithography enabler for node capacity" },
    { symbol: "AMAT", companyName: "Applied Materials", relationship: "Wafer fab equipment exposure" },
    { symbol: "LRCX", companyName: "Lam Research", relationship: "Etch and deposition supplier exposure" },
    { symbol: "MU", companyName: "Micron", relationship: "HBM memory ecosystem linkage" },
    { symbol: "MRVL", companyName: "Marvell", relationship: "Data center interconnect and ASIC exposure" },
    { symbol: "ANET", companyName: "Arista Networks", relationship: "AI networking demand follow-through" },
    { symbol: "SMCI", companyName: "Super Micro Computer", relationship: "Server platform demand proxy" },
    { symbol: "KLAC", companyName: "KLA", relationship: "Process control supplier for advanced nodes" },
    { symbol: "CDNS", companyName: "Cadence", relationship: "EDA tooling and chip design ecosystem" }
  ],
  MSFT: [
    { symbol: "NVDA", companyName: "NVIDIA", relationship: "Azure AI accelerator supplier exposure" },
    { symbol: "AMD", companyName: "AMD", relationship: "Cloud compute and accelerator supply chain linkage" },
    { symbol: "ANET", companyName: "Arista Networks", relationship: "Data center networking demand correlation" },
    { symbol: "SMCI", companyName: "Super Micro Computer", relationship: "Server infrastructure linkage" },
    { symbol: "MU", companyName: "Micron", relationship: "Memory demand through hyperscale build-out" },
    { symbol: "DELL", companyName: "Dell Technologies", relationship: "Enterprise AI hardware ecosystem proxy" },
    { symbol: "HPQ", companyName: "HP Inc.", relationship: "PC cycle and enterprise endpoint demand link" },
    { symbol: "QCOM", companyName: "Qualcomm", relationship: "Windows-on-ARM ecosystem supplier" },
    { symbol: "ORCL", companyName: "Oracle", relationship: "Cloud infrastructure peer-demand proxy" },
    { symbol: "PANW", companyName: "Palo Alto Networks", relationship: "Cybersecurity stack demand linkage" }
  ]
};

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function roundToTwo(value: number): number {
  return Math.round(value * 100) / 100;
}

function daysUntilIsoDate(isoDate: string): number {
  const now = new Date();
  const end = new Date(`${isoDate}T00:00:00.000Z`);
  const diff = end.getTime() - now.getTime();
  return Math.max(1, Math.ceil(diff / (24 * 60 * 60 * 1000)));
}

function riskDeltaBias(riskTolerance: WheelRiskTolerance): number {
  if (riskTolerance === "conservative") {
    return -0.03;
  }
  if (riskTolerance === "aggressive") {
    return 0.03;
  }
  return 0;
}

function variationOffsets(count: number): number[] {
  if (count === 3) return [-0.02, 0, 0.02];
  if (count === 4) return [-0.03, -0.01, 0.01, 0.03];
  return [-0.04, -0.02, 0, 0.02, 0.04];
}

function preferredExpirations(input: WheelGeneratorInput, expirations: string[]): string[] {
  const now = Date.now();
  const targetRange =
    input.expirationCycle === "weekly"
      ? { min: 5, max: 16 }
      : input.expirationCycle === "monthly"
        ? { min: 20, max: 50 }
        : { min: 60, max: 120 };
  const filtered = expirations.filter((dateIso) => {
    const dte = Math.ceil((new Date(`${dateIso}T00:00:00.000Z`).getTime() - now) / (24 * 60 * 60 * 1000));
    return dte >= targetRange.min && dte <= targetRange.max;
  });
  if (filtered.length > 0) {
    return filtered;
  }
  return expirations.slice(0, Math.min(8, expirations.length));
}

function parseEarningsDate(quote: Record<string, unknown>): string | null {
  const direct = quote["earningsTimestamp"];
  if (typeof direct === "number" && Number.isFinite(direct) && direct > 0) {
    return new Date(direct * 1000).toISOString();
  }
  const next = quote["earningsTimestampStart"];
  if (typeof next === "number" && Number.isFinite(next) && next > 0) {
    return new Date(next * 1000).toISOString();
  }
  return null;
}

async function resolveExpirationsForTicker(ticker: string): Promise<string[]> {
  const raw = await getYahooFinance2().options(ticker);
  const values = ((raw as { expirationDates?: Array<Date | string> }).expirationDates ?? [])
    .map((token) => {
      const parsed = token instanceof Date ? token : new Date(token);
      if (!Number.isFinite(parsed.getTime())) {
        return null;
      }
      return parsed.toISOString().slice(0, 10);
    })
    .filter((token): token is string => token !== null);
  if (values.length === 0) {
    return buildUpcomingFridayExpirations({ count: 8 });
  }
  return preferFridayExpirations(values);
}

function toLeg(contract: OptionContractData): WheelContractLeg {
  return {
    strike: roundToTwo(contract.strike_price),
    expiration: contract.expiration_date,
    premium: roundToTwo(contract.premium),
    bid: roundToTwo(contract.last_quote.bid),
    ask: roundToTwo(contract.last_quote.ask),
    impliedVolatilityPct: roundToTwo(contract.implied_volatility),
    delta: contract.greeks?.delta ?? null,
    gamma: contract.greeks?.gamma ?? null,
    thetaPerDay: contract.greeks?.theta_per_day ?? null,
    vegaPerOnePercentIv: contract.greeks?.vega_per_one_percent_iv ?? null
  };
}

function selectPutCandidates(
  chain: ChainForDate,
  targetPutDelta: number,
  minPremiumYieldPct: number,
  spot: number,
  dte: number
): LegCandidate[] {
  const rows: LegCandidate[] = [];
  for (const row of chain.optionChain) {
    if (!row.put || row.put.premium <= 0 || row.put.strike_price >= spot * 1.03) {
      continue;
    }
    const probExpireOtm = row.put.probability_expire_otm ?? 0.75;
    const assignment = clamp((1 - probExpireOtm) * 100, 1, 99);
    const syntheticDelta = clamp(assignment / 100, 0.05, 0.95);
    const premiumYieldPct = (row.put.premium / Math.max(row.put.strike_price, 1e-6)) * 100;
    const annualizedEstimate = premiumYieldPct * (365 / Math.max(dte, 1));
    if (annualizedEstimate < minPremiumYieldPct) {
      continue;
    }
    rows.push({
      leg: toLeg(row.put),
      assignmentProbabilityPct: roundToTwo(assignment),
      callAwayProbabilityPct: 0,
      syntheticDelta
    });
  }
  rows.sort(
    (a, b) =>
      Math.abs(a.syntheticDelta - targetPutDelta) - Math.abs(b.syntheticDelta - targetPutDelta)
  );
  return rows;
}

function selectCallCandidates(
  chain: ChainForDate,
  targetCallDelta: number,
  minPremiumYieldPct: number,
  spot: number,
  dte: number
): LegCandidate[] {
  const rows: LegCandidate[] = [];
  for (const row of chain.optionChain) {
    if (!row.call || row.call.premium <= 0 || row.call.strike_price <= spot * 0.99) {
      continue;
    }
    const probCalledAway = clamp((row.call.probability_called_away ?? 0.25) * 100, 1, 99);
    const syntheticDelta = clamp(probCalledAway / 100, 0.05, 0.95);
    const premiumYieldPct = (row.call.premium / Math.max(spot, 1e-6)) * 100;
    const annualizedEstimate = premiumYieldPct * (365 / Math.max(dte, 1));
    if (annualizedEstimate < minPremiumYieldPct * 0.65) {
      continue;
    }
    rows.push({
      leg: toLeg(row.call),
      assignmentProbabilityPct: 0,
      callAwayProbabilityPct: roundToTwo(probCalledAway),
      syntheticDelta
    });
  }
  rows.sort(
    (a, b) =>
      Math.abs(a.syntheticDelta - targetCallDelta) - Math.abs(b.syntheticDelta - targetCallDelta)
  );
  return rows;
}

function buildMonitoringRules(input: WheelGeneratorInput): string[] {
  const reentryLabel =
    input.reentryRule === "roll_immediately"
      ? "roll new short put next cycle"
      : input.reentryRule === "wait_pullback"
        ? "wait for a technical pullback before re-entry"
        : "stagger re-entry across two expirations";
  return [
    "Take profit at 70-85% of max premium when liquidity allows.",
    "Avoid opening fresh wheel legs into widening bid/ask spreads.",
    `After assignment or call-away, ${reentryLabel}.`,
    "Re-size to max position rules when spot volatility regime changes."
  ];
}

function buildWhyThisWorks(input: WheelGeneratorInput, dte: number, assignmentPct: number): string {
  const tone =
    input.riskTolerance === "conservative"
      ? "Conservative delta placement keeps assignment pressure controlled"
      : input.riskTolerance === "aggressive"
        ? "Aggressive delta placement increases premium capture while accepting more assignment risk"
        : "Balanced delta placement targets repeatable premium with controlled assignment probability";
  return `${tone}. The selected expirations concentrate on ${dte}-day cycles to keep capital turns frequent. Assignment probability near ${assignmentPct.toFixed(
    0
  )}% keeps the wheel active without forcing deep ITM exposure. The call leg offsets downside carry by recycling premium while preserving an exit path.`;
}

function buildPortfolioFit(
  ticker: string,
  topHoldingValueUsd: number,
  contracts: number,
  spot: number,
  availableCapitalUsd: number
): WheelPortfolioFit {
  const newExposure = contracts * 100 * spot;
  const projected = ((topHoldingValueUsd + newExposure) / Math.max(availableCapitalUsd, 1)) * 100;
  let fitLabel: WheelPortfolioFit["fitLabel"] = "fits_policy";
  let note = "Wheel sizing stays within typical concentration controls.";
  if (projected > 45) {
    fitLabel = "over_limit";
    note = "Projected exposure breaches a typical 45% single-name concentration cap.";
  } else if (projected > 30) {
    fitLabel = "concentrated";
    note = "Exposure is concentrated; consider reducing contracts or widening strike distance.";
  }
  return {
    tickerAlreadyHeld: topHoldingValueUsd > 0,
    currentHoldingMarketValueUsd: roundToTwo(topHoldingValueUsd),
    projectedAllocationPct: roundToTwo(projected),
    fitLabel,
    note
  };
}

function weightedGreek(values: Array<number | null | undefined>): number {
  const filtered = values.filter((n): n is number => typeof n === "number" && Number.isFinite(n));
  if (filtered.length === 0) {
    return 0;
  }
  return filtered.reduce((sum, n) => sum + n, 0) / filtered.length;
}

function defaultSupplierUniverse(rootTicker: string): Array<{ symbol: string; companyName: string; relationship: string }> {
  const mapped = SUPPLIER_RELATIONSHIP_MAP[rootTicker];
  if (mapped && mapped.length >= 10) {
    return mapped.slice(0, 10);
  }
  return [
    { symbol: "NVDA", companyName: "NVIDIA", relationship: "AI infrastructure supplier proxy" },
    { symbol: "AMD", companyName: "AMD", relationship: "Compute supplier proxy" },
    { symbol: "QCOM", companyName: "Qualcomm", relationship: "Connectivity silicon supplier proxy" },
    { symbol: "MU", companyName: "Micron", relationship: "Memory supplier proxy" },
    { symbol: "ANET", companyName: "Arista Networks", relationship: "Networking supplier proxy" },
    { symbol: "LRCX", companyName: "Lam Research", relationship: "Semiconductor equipment supplier proxy" },
    { symbol: "AMAT", companyName: "Applied Materials", relationship: "Fabrication equipment supplier proxy" },
    { symbol: "ON", companyName: "onsemi", relationship: "Automotive and industrial semiconductor supplier" },
    { symbol: "STM", companyName: "STMicroelectronics", relationship: "Embedded semiconductor supplier proxy" },
    { symbol: "AVGO", companyName: "Broadcom", relationship: "Connectivity and infrastructure supplier proxy" }
  ];
}

async function evaluateSupplierCandidate(input: {
  supplier: { symbol: string; companyName: string; relationship: string };
  rootTicker: string;
}): Promise<WheelRelatedSupplierCandidate | null> {
  const symbol = input.supplier.symbol.trim().toUpperCase();
  if (!symbol || symbol === input.rootTicker) {
    return null;
  }
  const yahoo = getYahooFinance2();
  const quote = (await yahooQuoteWithValidationFallback(
    yahoo,
    symbol,
    "wheel related supplier quote"
  )) as Record<string, unknown>;
  const spotRaw = quote["regularMarketPrice"] ?? quote["postMarketPrice"] ?? quote["preMarketPrice"];
  if (typeof spotRaw !== "number" || !Number.isFinite(spotRaw) || spotRaw <= 0) {
    return null;
  }
  const spotPrice = roundToTwo(spotRaw);
  const expirations = await resolveExpirationsForTicker(symbol);
  const expiration = expirations[0];
  if (!expiration) {
    return null;
  }
  const dte = daysUntilIsoDate(expiration);
  const chain = await fetchYahooOptionChainForExpiration(symbol, expiration, spotPrice, dte);
  if (!chain || chain.optionChain.length === 0) {
    return null;
  }

  const lower = spotPrice * 0.92;
  const upper = spotPrice * 1.08;
  const neighborhood = chain.optionChain.filter((row) => row.strike >= lower && row.strike <= upper);
  const effectiveRows = neighborhood.length > 0 ? neighborhood : chain.optionChain.slice(0, Math.min(12, chain.optionChain.length));
  const ivValues = effectiveRows
    .flatMap((row) => [row.call?.implied_volatility ?? null, row.put?.implied_volatility ?? null])
    .filter((value): value is number => typeof value === "number" && Number.isFinite(value) && value > 0);
  if (ivValues.length === 0) {
    return null;
  }
  const avgIvPct = roundToTwo(ivValues.reduce((sum, value) => sum + value, 0) / ivValues.length);

  const callPremiums = effectiveRows
    .map((row) => row.call?.premium ?? null)
    .filter((value): value is number => typeof value === "number" && Number.isFinite(value) && value > 0);
  const avgCallPremium = callPremiums.length > 0 ? callPremiums.reduce((sum, value) => sum + value, 0) / callPremiums.length : 0;
  const estimatedWheelYieldPct = roundToTwo((avgCallPremium / Math.max(spotPrice, 1e-6)) * (365 / Math.max(dte, 1)) * 100);

  const momentumRaw = quote["regularMarketChangePercent"];
  const momentum30dPct =
    typeof momentumRaw === "number" && Number.isFinite(momentumRaw) ? roundToTwo(momentumRaw) : 0;

  const score = roundToTwo(avgIvPct * 0.62 + estimatedWheelYieldPct * 0.28 + Math.max(momentum30dPct, -5) * 0.1);
  const rationale = `${input.supplier.relationship}. Avg IV ${avgIvPct.toFixed(
    1
  )}% with estimated wheel yield ${estimatedWheelYieldPct.toFixed(
    1
  )}% annualized supports premium-selling consideration.`;

  return {
    symbol,
    companyName: input.supplier.companyName,
    relationship: input.supplier.relationship,
    spotPrice,
    avgImpliedVolatilityPct: avgIvPct,
    estimatedWheelYieldPct,
    momentum30dPct,
    score,
    rationale
  };
}

async function buildRelatedSuppliers(rootTicker: string): Promise<WheelRelatedSuppliers> {
  const supplierUniverse = defaultSupplierUniverse(rootTicker);
  const evaluated = await Promise.all(
    supplierUniverse.map((supplier) =>
      evaluateSupplierCandidate({ supplier, rootTicker }).catch(() => null)
    )
  );
  const candidates = evaluated.filter((candidate): candidate is WheelRelatedSupplierCandidate => candidate !== null);
  const ranked = candidates
    .sort((a, b) => b.score - a.score)
    .slice(0, 3);
  const topCandidates = [...ranked];
  if (topCandidates.length < 3) {
    const missing = 3 - topCandidates.length;
    const used = new Set(topCandidates.map((candidate) => candidate.symbol));
    const fallback = supplierUniverse
      .filter((supplier) => !used.has(supplier.symbol))
      .slice(0, missing)
      .map((supplier, idx) => ({
        symbol: supplier.symbol,
        companyName: supplier.companyName,
        relationship: supplier.relationship,
        spotPrice: 0,
        avgImpliedVolatilityPct: 45 - idx,
        estimatedWheelYieldPct: 10 - idx,
        momentum30dPct: 0,
        score: 55 - idx,
        rationale:
          "Fallback candidate added because live chain data was incomplete during this run; validate IV and premiums before execution."
      }));
    topCandidates.push(...fallback);
  }
  return {
    rootTicker,
    universeScanned: supplierUniverse.length,
    topCandidates,
    selectionRule:
      "Top candidates selected from a 10-name related supplier universe using highest blended IV + estimated wheel yield score."
  };
}

export async function generateWheelPayload(
  session: SessionUser,
  input: WheelGeneratorInput
): Promise<WheelGeneratedPayload> {
  const ticker = input.ticker.trim().toUpperCase();
  const yahoo = getYahooFinance2();
  const quote = (await yahooQuoteWithValidationFallback(
    yahoo,
    ticker,
    "xoptions wheel generator quote"
  )) as Record<string, unknown>;
  const spotPriceRaw = quote["regularMarketPrice"] ?? quote["postMarketPrice"] ?? quote["preMarketPrice"];
  if (typeof spotPriceRaw !== "number" || !Number.isFinite(spotPriceRaw) || spotPriceRaw <= 0) {
    throw new Error("Could not resolve live market price for selected ticker.");
  }
  const spotPrice = roundToTwo(spotPriceRaw);
  const earningsIso = parseEarningsDate(quote);
  const earningsWithin14Days =
    earningsIso != null &&
    (new Date(earningsIso).getTime() - Date.now()) / (24 * 60 * 60 * 1000) <= 14;

  const expirations = await resolveExpirationsForTicker(ticker);
  const preferred = preferredExpirations(input, expirations);
  const chainCache = new Map<string, ChainForDate | null>();

  async function loadChain(expiration: string): Promise<ChainForDate | null> {
    if (chainCache.has(expiration)) {
      return chainCache.get(expiration) ?? null;
    }
    const dte = daysUntilIsoDate(expiration);
    const chain = await fetchYahooOptionChainForExpiration(ticker, expiration, spotPrice, dte);
    chainCache.set(expiration, chain);
    return chain;
  }

  const basePutDelta = clamp(input.targetPutDelta + riskDeltaBias(input.riskTolerance), 0.08, 0.4);
  const baseCallDelta = clamp(input.targetCallDelta + riskDeltaBias(input.riskTolerance), 0.12, 0.45);

  const offsets = variationOffsets(input.variationCount);
  const ideas: WheelIdea[] = [];

  for (let i = 0; i < offsets.length; i += 1) {
    const targetPutDelta = clamp(basePutDelta + offsets[i]!, 0.08, 0.45);
    const targetCallDelta = clamp(baseCallDelta + offsets[i]!, 0.12, 0.48);
    const expiration = preferred[i % preferred.length]!;
    const chain = await loadChain(expiration);
    if (!chain) {
      continue;
    }
    const dte = daysUntilIsoDate(chain.actualExpiration);
    if (input.avoidEarningsWeek && earningsWithin14Days && dte <= 14) {
      continue;
    }
    const putCandidates = selectPutCandidates(
      chain,
      targetPutDelta,
      input.minimumPremiumYieldPerCyclePct,
      spotPrice,
      dte
    );
    const callCandidates = selectCallCandidates(
      chain,
      targetCallDelta,
      input.minimumPremiumYieldPerCyclePct,
      spotPrice,
      dte
    );
    const put = putCandidates[0];
    const call = callCandidates[0];
    if (!put || !call) {
      continue;
    }

    const maxWheelNotional = (input.availableCapitalUsd * input.maxPositionSizePct) / 100;
    const contracts = Math.max(1, Math.floor(maxWheelNotional / Math.max(put.leg.strike * 100, 1)));
    const requiredCapitalUsd = roundToTwo(put.leg.strike * 100 * contracts);
    const premiumIncomePerCycleUsd = roundToTwo((put.leg.premium + call.leg.premium) * 100 * contracts);
    const annualizedYieldPct = roundToTwo(
      (premiumIncomePerCycleUsd / Math.max(requiredCapitalUsd, 1e-6)) * (365 / Math.max(dte, 1)) * 100
    );
    const assignmentProbabilityPct = roundToTwo(put.assignmentProbabilityPct);
    const callAwayProbabilityPct = roundToTwo(call.callAwayProbabilityPct);

    ideas.push({
      ideaId: `${ticker}-wheel-${i + 1}`,
      headline: `${ticker} Wheel ${i + 1}: ${put.leg.strike.toFixed(0)}P / ${call.leg.strike.toFixed(0)}C`,
      putLeg: put.leg,
      callLeg: call.leg,
      contracts,
      requiredCapitalUsd,
      premiumIncomePerCycleUsd,
      annualizedYieldPct,
      assignmentProbabilityPct,
      callAwayProbabilityPct,
      maxCapitalAtRiskUsd: requiredCapitalUsd,
      greeksSnapshot: {
        delta: roundToTwo(weightedGreek([put.leg.delta, call.leg.delta])),
        gamma: roundToTwo(weightedGreek([put.leg.gamma, call.leg.gamma])),
        thetaPerDay: roundToTwo(weightedGreek([put.leg.thetaPerDay, call.leg.thetaPerDay])),
        vegaPerOnePercentIv: roundToTwo(
          weightedGreek([put.leg.vegaPerOnePercentIv, call.leg.vegaPerOnePercentIv])
        )
      },
      cycleBreakdown: [
        `Sell ${contracts}x ${put.leg.expiration} ${put.leg.strike.toFixed(2)} put(s) and target ${put.leg.premium.toFixed(2)} credit.`,
        "If assigned, acquire shares at strike and lower net basis by put premium received.",
        `Sell covered calls at ${call.leg.strike.toFixed(2)} for ${call.leg.premium.toFixed(2)} premium on the next cycle.`,
        "Close at 70-85% max premium or roll if assignment/call-away probability jumps above plan."
      ],
      whyThisWorks: buildWhyThisWorks(input, dte, assignmentProbabilityPct)
    });
  }

  if (ideas.length === 0) {
    throw new Error("No liquid wheel candidates matched the selected filters. Loosen delta or yield targets.");
  }

  const holdings = await getTopStockHoldingsByValue(session, 24);
  const topHoldingValue =
    holdings.holdings.find((row) => row.symbol.toUpperCase() === ticker)?.marketValue ?? 0;
  const topContracts = ideas[0]?.contracts ?? 1;
  const portfolioFit = buildPortfolioFit(
    ticker,
    topHoldingValue,
    topContracts,
    spotPrice,
    input.availableCapitalUsd
  );

  const allIvValues = Array.from(chainCache.values())
    .flatMap((chain) =>
      chain?.optionChain.flatMap((row) => [
        row.call?.implied_volatility ?? null,
        row.put?.implied_volatility ?? null
      ]) ?? []
    )
    .filter((value): value is number => typeof value === "number" && Number.isFinite(value) && value > 0);
  const avgIv = allIvValues.length > 0 ? allIvValues.reduce((sum, value) => sum + value, 0) / allIvValues.length : null;
  const ivRankPercent = avgIv == null ? null : roundToTwo(clamp(((avgIv - 15) / 55) * 100, 1, 99));

  const rootSnapshot: WheelUnderlyingSnapshot = {
    ticker,
    spotPrice,
    currency: typeof quote["currency"] === "string" ? (quote["currency"] as string) : "USD",
    ivRankPercent,
    earningsDateIso: earningsIso,
    earningsWithin14Days,
    sector: typeof quote["sectorDisp"] === "string" ? (quote["sectorDisp"] as string) : null
  };

  const relatedSuppliers = await buildRelatedSuppliers(ticker);

  const executiveSummary = `${ticker} wheel screen produced ${ideas.length} candidate cycle${
    ideas.length > 1 ? "s" : ""
  } with ${ideas[0]!.annualizedYieldPct.toFixed(
    1
  )}% top annualized yield estimate and ${ideas[0]!.assignmentProbabilityPct.toFixed(
    0
  )}% initial assignment probability. Related supplier scan evaluated ${
    relatedSuppliers.universeScanned
  } names and ranked ${relatedSuppliers.topCandidates.length} high-IV wheel candidates.`;

  return {
    generatedAtIso: new Date().toISOString(),
    input,
    rootSnapshot,
    ideas,
    portfolioFit,
    relatedSuppliers,
    executiveSummary,
    monitoringRules: buildMonitoringRules(input),
    disclaimer: WHEEL_DISCLAIMER
  };
}
