/**
 * Deterministic routing for desk CSP / covered-call scan asks (e.g. "xoptions CSP ideas for ASTS 7-14 DTE").
 * Mirrors narrow intent detection in `xchat-ask-routing.ts`; execution uses `atx_function` → `options_scan`.
 */

import {
  parseMaxCollateralUsdFromText,
  pickOptionsScanTopIdeas,
  type OptionsScanDeskLeg
} from "@/modules/xchat/options-scan-ranking";

export type ParsedOptionsScanDeskRequest = {
  symbol: string;
  optionType: "put" | "call";
  minDte: number;
  maxDte: number;
  query: string;
  maxCollateralUsd: number | null;
};

const TICKER_RE = /\b([A-Z][A-Z0-9.-]{0,11})\b/g;

const NON_TICKER = new Set([
  "CSP",
  "PUT",
  "PUTS",
  "CALL",
  "CALLS",
  "DTE",
  "IV",
  "OI",
  "USD",
  "XOPTIONS",
  "OPTIONS",
  "IDEA",
  "IDEAS",
  "FOR",
  "WITH",
  "FROM",
  "THE",
  "AND",
  "RUN"
]);

function normalizeMessage(message: string): string {
  return message.trim().toLowerCase().replace(/\s+/g, " ");
}

/** Extract equity ticker from natural-language desk scan prompts. */
export function extractOptionsScanSymbol(message: string): string | undefined {
  const m = message.trim();
  if (!m) {
    return undefined;
  }
  const forMatch = m.match(/\b(?:for|on)\s+([A-Za-z][A-Za-z0-9.-]{0,11})\b/i);
  if (forMatch?.[1]) {
    const sym = forMatch[1].trim().toUpperCase();
    if (/^[A-Z][A-Z0-9.-]{0,11}$/.test(sym) && !NON_TICKER.has(sym)) {
      return sym;
    }
  }
  const withMatch = m.match(/\b([A-Za-z][A-Za-z0-9.-]{0,11})\s+with\b/i);
  if (withMatch?.[1]) {
    const sym = withMatch[1].trim().toUpperCase();
    if (/^[A-Z][A-Z0-9.-]{0,11}$/.test(sym) && !NON_TICKER.has(sym)) {
      return sym;
    }
  }
  const candidates: string[] = [];
  for (const match of m.toUpperCase().matchAll(TICKER_RE)) {
    const sym = match[1]?.trim().toUpperCase();
    if (!sym || sym.length < 1 || sym.length > 12 || NON_TICKER.has(sym)) {
      continue;
    }
    if (/^[A-Z][A-Z0-9.-]{0,11}$/.test(sym)) {
      candidates.push(sym);
    }
  }
  return candidates[0];
}

export function parseDteRangeFromMessage(message: string): { minDte: number; maxDte: number } | null {
  const m = message.trim().toLowerCase();
  const range =
    m.match(/\b(\d{1,3})\s*[-–]\s*(\d{1,3})\s*(?:dte|days?)\b/) ??
    m.match(/\b(\d{1,3})\s+to\s+(\d{1,3})\s*(?:dte|days?)\b/);
  if (range) {
    const a = Number.parseInt(range[1]!, 10);
    const b = Number.parseInt(range[2]!, 10);
    if (Number.isFinite(a) && Number.isFinite(b)) {
      return { minDte: Math.min(a, b), maxDte: Math.max(a, b) };
    }
  }
  const maxOnly = m.match(/\bdte\s*(?:<=|<|=)\s*(\d{1,3})\b/);
  if (maxOnly) {
    const max = Number.parseInt(maxOnly[1]!, 10);
    if (Number.isFinite(max)) {
      return { minDte: 0, maxDte: max };
    }
  }
  const minOnly = m.match(/\bdte\s*(?:>=|>)\s*(\d{1,3})\b/);
  if (minOnly) {
    const min = Number.parseInt(minOnly[1]!, 10);
    if (Number.isFinite(min)) {
      return { minDte: min, maxDte: Math.min(365, min + 14) };
    }
  }
  return null;
}

function hasCspOrPutIdeasIntent(normalized: string): boolean {
  return (
    /\b(?:cash[- ]secured|csp)\b/.test(normalized) ||
    /\bput\s+ideas?\b/.test(normalized) ||
    /\bputs?\s+ideas?\b/.test(normalized) ||
    (/\bput\b/.test(normalized) && /\bideas?\b/.test(normalized))
  );
}

function hasCoveredCallIdeasIntent(normalized: string): boolean {
  return (
    /\bcovered[- ]calls?\b/.test(normalized) ||
    /\bcovered call\b/.test(normalized) ||
    /\bcall\s+ideas?\b/.test(normalized) ||
    (/\bcall\b/.test(normalized) && /\bideas?\b/.test(normalized))
  );
}

/**
 * Direct `options_scan` when the user names a symbol and CSP/CC scan intent (incl. xOptions phrasing).
 * Excludes generic education ("what is a CSP") and portfolio-wide action scan templates.
 */
function isHotPicksXchatHandoff(normalized: string): boolean {
  return /\bhot\s+picks?\b/.test(normalized);
}

export function shouldRunDirectOptionsScan(message: string): boolean {
  const normalized = normalizeMessage(message);
  if (normalized.length < 8) {
    return false;
  }
  if (isHotPicksXchatHandoff(normalized)) {
    return false;
  }
  if (shouldRunOptionsActionScanTemplate(normalized)) {
    return false;
  }
  if (/^(what is|what's|define|explain)\s+/.test(normalized)) {
    return false;
  }
  const symbol = extractOptionsScanSymbol(message);
  if (!symbol) {
    return false;
  }
  const csp = hasCspOrPutIdeasIntent(normalized);
  const cc = hasCoveredCallIdeasIntent(normalized);
  if (!csp && !cc) {
    return false;
  }
  /** Exclude bare "ideas" so strategy-job preflight keeps "covered call ideas for …". */
  const hasExplicitDeskScanCue =
    /\bscan\b/.test(normalized) ||
    /\bxoptions\b/.test(normalized) ||
    /\b\d+\s*[-–]\s*\d+\s*(?:dte|days?)\b/.test(normalized) ||
    /\bdte\s*(?:<=|<|=|>=|>)\s*\d{1,3}\b/.test(normalized) ||
    (/\bdte\b/.test(normalized) && /\b\d{1,3}\b/.test(normalized));
  return hasExplicitDeskScanCue;
}

function shouldRunOptionsActionScanTemplate(normalized: string): boolean {
  return (
    normalized === "options_scan" ||
    normalized === "/options_scan" ||
    /\bscan my options\b/.test(normalized) ||
    /\boptions action scan\b/.test(normalized) ||
    /\bwhat should i do with my options\b/.test(normalized)
  );
}

export function buildOptionsScanArgsFromMessage(message: string): ParsedOptionsScanDeskRequest | null {
  if (!shouldRunDirectOptionsScan(message)) {
    return null;
  }
  const normalized = normalizeMessage(message);
  const symbol = extractOptionsScanSymbol(message);
  if (!symbol) {
    return null;
  }
  const optionType: "put" | "call" = hasCoveredCallIdeasIntent(normalized) && !hasCspOrPutIdeasIntent(normalized)
    ? "call"
    : "put";
  const dte = parseDteRangeFromMessage(message) ?? { minDte: 0, maxDte: 14 };
  return {
    symbol,
    optionType,
    minDte: dte.minDte,
    maxDte: dte.maxDte,
    query: message.trim(),
    maxCollateralUsd: parseMaxCollateralUsdFromText(message)
  };
}

type OptionsScanRow = Pick<
  OptionsScanDeskLeg,
  "strike" | "dte" | "mid" | "ivPct" | "openInterest" | "deltaAbs"
>;

function formatUsd(value: number | undefined): string {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return "—";
  }
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(value);
}

function formatPct(value: number | undefined): string {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return "—";
  }
  return `${value.toFixed(1)}%`;
}

export function formatOptionsScanDeskMarkdown(payload: {
  symbol: string;
  spot: number | null;
  referencePrice?: number | null;
  optionType: "put" | "call";
  criteria: { minDte: number; maxDte: number; maxCollateralUsd?: number | null };
  rows: OptionsScanRow[];
  note?: string;
}): string {
  const { symbol, spot, referencePrice, optionType, criteria, rows, note } = payload;
  const ref =
    typeof referencePrice === "number" && Number.isFinite(referencePrice) && referencePrice > 0
      ? referencePrice
      : spot;
  const refNote =
    ref != null &&
    spot != null &&
    Math.abs(ref - spot) / Math.max(spot, 1e-6) > 0.01
      ? ` · desk anchor ${formatUsd(ref)} (cost basis/entry)`
      : "";
  const budgetNote =
    criteria.maxCollateralUsd != null && criteria.maxCollateralUsd > 0
      ? ` · max collateral ${formatUsd(criteria.maxCollateralUsd)}`
      : "";
  const spotLine =
    typeof spot === "number" && Number.isFinite(spot)
      ? `${symbol} spot ${formatUsd(spot)}${refNote}${budgetNote} — ${optionType === "put" ? "CSP" : "covered call"} scan · DTE ${criteria.minDte}–${criteria.maxDte}.`
      : `${symbol}${budgetNote} — ${optionType === "put" ? "CSP" : "covered call"} scan · DTE ${criteria.minDte}–${criteria.maxDte} (spot unavailable).`;

  if (rows.length === 0) {
    return [
      `### ${optionType === "put" ? "CSP" : "Covered call"} ideas — ${symbol}`,
      "",
      spotLine,
      "",
      note?.trim() || "No contracts matched filters. Try widening DTE or relaxing delta/OI thresholds.",
      "",
      "_Not investment advice. Options involve substantial risk._"
    ].join("\n");
  }

  const top = rows.slice(0, 5);
  const isPut = optionType === "put";
  const rocDenominator = (strike: number) => (isPut ? strike : (spot ?? strike));
  const header = isPut
    ? "| Strike | Premium | IV | OI | Delta | Breakeven | ROC (ann.) | Cash Req | Assignment Risk | Desk Note |"
    : "| Strike | Premium | IV | OI | Delta | Upside to Strike | ROC (ann.) | Notional (100sh) | Call-Away Risk | Desk Note |";
  const sep = "| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | --- | --- |";
  const lines = top.map((row) => {
    const premium = row.mid;
    const strike = row.strike;
    const dte = Math.max(1, row.dte);
    const roc =
      rocDenominator(strike) > 0
        ? `${(((premium / rocDenominator(strike)) * (365 / dte)) * 100).toFixed(1)}%`
        : "—";
    const breakeven = isPut ? formatUsd(strike - premium) : "—";
    const cashReq = isPut ? formatUsd(strike * 100) : "—";
    const upside =
      !isPut && typeof spot === "number" && spot > 0
        ? `${(((strike - spot) / spot) * 100).toFixed(1)}%`
        : "—";
    const notional = !isPut ? formatUsd(strike * 100) : "—";
    const risk = row.openInterest >= 500 ? "Moderate" : "Thin";
    const desk = `DTE ${row.dte}`;
    if (isPut) {
      return `| ${formatUsd(strike)} | ${formatUsd(premium)} | ${formatPct(row.ivPct)} | ${row.openInterest.toLocaleString("en-US")} | ${row.deltaAbs != null ? row.deltaAbs.toFixed(2) : "—"} | ${breakeven} | ${roc} | ${cashReq} | ${risk} | ${desk} |`;
    }
    return `| ${formatUsd(strike)} | ${formatUsd(premium)} | ${formatPct(row.ivPct)} | ${row.openInterest.toLocaleString("en-US")} | ${row.deltaAbs != null ? row.deltaAbs.toFixed(2) : "—"} | ${upside} | ${roc} | ${notional} | ${risk} | ${desk} |`;
  });

  const topIdeas = pickOptionsScanTopIdeas(
    top.map((row) => ({
      expiration: "",
      dte: row.dte,
      strike: row.strike,
      optionType,
      bid: row.mid,
      ask: row.mid,
      mid: row.mid,
      ivPct: row.ivPct,
      openInterest: row.openInterest,
      deltaAbs: row.deltaAbs,
      deltaRaw: row.deltaAbs == null ? null : optionType === "put" ? -row.deltaAbs : row.deltaAbs
    })),
    optionType
  );
  const ranked = topIdeas.map(
    ({ tag, leg }) =>
      `- **${tag}:** ${formatUsd(leg.strike)} · ${formatUsd(leg.mid)} premium · DTE ${leg.dte}`
  );

  return [
    `### ${isPut ? "CSP" : "Covered call"} ideas — ${symbol}`,
    "",
    spotLine,
    "",
    header,
    sep,
    ...lines,
    "",
    "**Top 3 ranked ideas**",
    ...ranked,
    "",
    "_Not investment advice. Quotes are indicative; verify liquidity before execution._"
  ].join("\n");
}
