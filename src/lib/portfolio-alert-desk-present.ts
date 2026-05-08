import { parseAlertDte } from "@/lib/portfolio-alert-insights";
import {
    portfolioAlertScannerMetadataV1Schema,
    type PortfolioAlertScannerMetadataV1
} from "@/lib/portfolio-alert-scan-metadata";

/** Strip NL user price-rule metadata so options-scanner desk UI stays type-safe. */
export function portfolioAlertRowScannerMetadata(raw: unknown): PortfolioAlertScannerMetadataV1 | null {
  const parsed = portfolioAlertScannerMetadataV1Schema.safeParse(raw);
  return parsed.success ? parsed.data : null;
}

/** App `/portfolio/alerts` row — includes optional scanner metadata from Mongo. */
export type PortfolioAlertRowVm = {
  id: string;
  title: string;
  body: string | null;
  severity: "info" | "warning" | "critical";
  status: string;
  symbol: string | null;
  portfolioName: string | null;
  accountId: string | null;
  accountName: string | null;
  accountType: string | null;
  createdAt: string;
  updatedAt: string;
  metadata: PortfolioAlertScannerMetadataV1 | null;
};

export type AlertSurfaceKind = "options_scanner" | "watchlist_price" | "account_general";

export function classifyAlertSurface(title: string, body: string | null): AlertSurfaceKind {
  const t = title.toLowerCase();
  const b = (body ?? "").toLowerCase();
  if (t.startsWith("price rule:")) {
    return "account_general";
  }
  if (t.includes("option scanner") || /\[close:(BUY_TO_CLOSE|SELL_TO_CLOSE)\]/i.test(body ?? "")) {
    return "options_scanner";
  }
  if (t.includes("price alert") || b.includes("price moved")) {
    return "watchlist_price";
  }
  return "account_general";
}

export function extractCloseKindFromBody(body: string | null | undefined): "BUY_TO_CLOSE" | "SELL_TO_CLOSE" | null {
  const m = body?.match(/\[close:(BUY_TO_CLOSE|SELL_TO_CLOSE)\]/i);
  if (!m?.[1]) {
    return null;
  }
  return m[1].toUpperCase() === "SELL_TO_CLOSE" ? "SELL_TO_CLOSE" : "BUY_TO_CLOSE";
}

export function parseContractKeyFromBody(body: string | null | undefined): string | null {
  const m = body?.match(/\[afp:([^\]]+)\]/);
  if (!m?.[1]) {
    return null;
  }
  return m[1].replace(/\|acct:[a-f0-9]{24}$/i, "").trim();
}

export type ParsedContractKey = {
  underlying: string;
  expYmd: string;
  strike: number;
  optionType: "call" | "put";
};

export function parseContractKey(key: string): ParsedContractKey | null {
  const base = key.replace(/\|acct:[a-f0-9]{24}$/i, "");
  const parts = base.split("|");
  if (parts.length < 4) {
    return null;
  }
  const [u, ymd, strikeRaw, otRaw] = parts;
  if (!u || !ymd || !/^\d{4}-\d{2}-\d{2}$/.test(ymd)) {
    return null;
  }
  const strike = Number.parseFloat(strikeRaw ?? "");
  if (!Number.isFinite(strike)) {
    return null;
  }
  const ot = (otRaw ?? "").toLowerCase();
  if (ot !== "call" && ot !== "put") {
    return null;
  }
  return { underlying: u.toUpperCase(), expYmd: ymd, strike, optionType: ot };
}

function monthDayYearUtc(ymd: string): string {
  const d = Date.parse(`${ymd}T12:00:00.000Z`);
  if (!Number.isFinite(d)) {
    return ymd;
  }
  return new Date(d).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC"
  });
}

export function formatContractDeskLabel(parsed: ParsedContractKey): string {
  const cp = parsed.optionType === "call" ? "Call" : "Put";
  return `${parsed.underlying} ${monthDayYearUtc(parsed.expYmd)} $${parsed.strike} ${cp}`;
}

export function optionPositionLabelFromClose(
  close: "BUY_TO_CLOSE" | "SELL_TO_CLOSE" | null,
  optionType: "call" | "put"
): string {
  if (!close) {
    return "Option leg";
  }
  if (close === "BUY_TO_CLOSE") {
    return optionType === "call" ? "Short call" : "Short put";
  }
  return optionType === "call" ? "Long call" : "Long put";
}

export function formatRelativeTime(iso: string, nowMs: number = Date.now()): string {
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) {
    return "—";
  }
  const sec = Math.max(0, Math.floor((nowMs - t) / 1000));
  if (sec < 45) {
    return "just now";
  }
  const min = Math.floor(sec / 60);
  if (min < 60) {
    return `${min}m ago`;
  }
  const hr = Math.floor(min / 60);
  if (hr < 48) {
    return `${hr}h ago`;
  }
  const day = Math.floor(hr / 24);
  return `${day}d ago`;
}

export type RiskPill = { id: string; label: string; value: string };

export function buildRiskPills(
  body: string | null,
  title: string,
  metadata: PortfolioAlertScannerMetadataV1 | null
): RiskPill[] {
  const pills: RiskPill[] = [];
  const dte = metadata?.metrics.dte ?? parseAlertDte(body, title);
  const theta = metadata?.metrics.thetaPerDayUsd;
  if (theta != null && Number.isFinite(theta)) {
    const sign = theta >= 0 ? "+" : "";
    pills.push({ id: "theta", label: "Theta / day", value: `${sign}$${Math.abs(theta).toFixed(2)}` });
  } else if (dte != null) {
    pills.push({ id: "theta", label: "Theta", value: dte <= 7 ? "Accel" : "Watch" });
  }
  const oi = metadata?.metrics.openInterest;
  if (dte != null && oi != null && dte <= 5 && oi >= 500) {
    const pinPct = Math.min(95, Math.round(38 + Math.log10(oi + 10) * 18 - dte * 5));
    pills.push({
      id: "pin",
      label: "Pin risk",
      value: dte <= 2 ? `High ~${pinPct}%` : `Elevated`
    });
  }
  const hay = `${title}\n${body ?? ""}`.toLowerCase();
  const conf = metadata?.metrics.finalConfidence;
  if (hay.includes("gamma") || (typeof conf === "number" && conf >= 85 && dte != null && dte <= 3)) {
    pills.push({ id: "gamma", label: "Gamma", value: "Spike" });
  }
  return pills.slice(0, 4);
}

export function buildHumanAlertSummary(
  body: string | null,
  title: string,
  metadata: PortfolioAlertScannerMetadataV1 | null
): string {
  const dte = metadata?.metrics.dte ?? parseAlertDte(body, title);
  const bits: string[] = [];
  if (dte != null) {
    bits.push(`${dte} DTE`);
  }
  const theta = metadata?.metrics.thetaPerDayUsd;
  if (theta != null && Number.isFinite(theta)) {
    bits.push(`theta ${theta >= 0 ? "+" : ""}$${Math.abs(theta).toFixed(2)}/day`);
  }
  const snippet = body
    ?.split("\n")
    .map((l) => l.trim())
    .find((l) => l.length > 12 && !l.startsWith("[") && !l.toLowerCase().startsWith("source:"));
  let tail = "Review sizing vs live broker marks — not financial advice.";
  if (snippet) {
    tail = snippet.length > 140 ? `${snippet.slice(0, 137)}…` : snippet;
  }
  return bits.length > 0 ? `${bits.join(" · ")} — ${tail}` : tail;
}

export function scannerRuleLine(title: string): string {
  if (title.toLowerCase().startsWith("option scanner:")) {
    const rest = title.replace(/^option\s*scanner:\s*/i, "").trim();
    return rest.length > 0 ? rest : title;
  }
  return title;
}

function rollTargetExpLabel(parsed: ParsedContractKey | null, horizonDays: number): string | null {
  if (!parsed) {
    return null;
  }
  const t = Date.parse(`${parsed.expYmd}T12:00:00.000Z`);
  if (!Number.isFinite(t)) {
    return null;
  }
  const next = new Date(t + horizonDays * 86400000);
  return next.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC"
  });
}

export type ActionPreviewKind = "close" | "roll30" | "rollStrike";

export type ActionPreviewLine = { primary: string; tooltip: string; framing: string };

export function buildActionPreviewLines(input: {
  parsed: ParsedContractKey | null;
  closeKind: "BUY_TO_CLOSE" | "SELL_TO_CLOSE" | null;
  symbol: string | null;
  metadata: PortfolioAlertScannerMetadataV1 | null;
}): Record<ActionPreviewKind, ActionPreviewLine> {
  const mark = input.metadata?.metrics.mark;
  const dte = input.metadata?.metrics.dte ?? null;
  const pnl = input.metadata?.metrics.pnlPct;
  const pnlBit =
    pnl != null && Number.isFinite(pnl) ? `${pnl >= 0 ? "+" : ""}${pnl.toFixed(1)}% vs entry (scanner)` : "P/L vs entry (verify)";
  const est100 =
    mark != null && Number.isFinite(mark) ? `~$${(mark * 100).toFixed(0)} / 1-lot notional (×100)` : "mid — verify live quote";
  const closeVerb = input.closeKind === "SELL_TO_CLOSE" ? "credit" : "debit";
  const closeFraming = input.closeKind === "BUY_TO_CLOSE" ? "Conservative" : "Balanced";
  const rollDate = rollTargetExpLabel(input.parsed, 30);

  return {
    close: {
      primary: `Close @ mid → est. ${closeVerb} ${est100}; ${pnlBit}.`,
      tooltip: `${closeFraming}: flatten gamma / pin tail. Not financial advice.`,
      framing: closeFraming
    },
    roll30: {
      primary: rollDate
        ? `Roll ~30 DTE${dte != null ? ` (now ${dte} DTE)` : ""} → anchor ${rollDate} cycle (illustrative); net credit/debit from next print.`
        : `Roll ~30 DTE → pick next monthly; confirm chain.`,
      tooltip: "Balanced: reset clock on premium. Not financial advice.",
      framing: "Balanced"
    },
    rollStrike: {
      primary: `Roll & nudge strike toward ~0.30–0.35 Δ short call if IV holds; keep width tight.`,
      tooltip: "Aggressive: more premium, more tail. Not financial advice.",
      framing: "Aggressive"
    }
  };
}

export function dteBadgeTone(dte: number | null): "critical" | "warning" | "muted" {
  if (dte === null) {
    return "muted";
  }
  if (dte <= 3) {
    return "critical";
  }
  if (dte <= 7) {
    return "warning";
  }
  return "muted";
}

export function buildPortfolioContextLines(input: {
  accountName: string | null;
  accountType: string | null;
  symbolUpper: string | null;
}): string[] {
  const lines: string[] = [];
  const an = input.accountName?.trim();
  if (an) {
    lines.push(
      `This alert is anchored on **${an}**${input.accountType ? ` (${input.accountType})` : ""}. Book-level theta % and cross-account correlation roll-ups ship with portfolio Greek snapshots — use Portfolio + xOptions for live context.`
    );
  }
  const sym = input.symbolUpper?.trim();
  if (sym) {
    lines.push(`Jump to **Portfolio** holdings or **xOptions** for ${sym} chain + payoff sim.`);
  }
  return lines;
}

export function extractOptionMarkFromBody(body: string | null): number | null {
  const m = body?.match(/\bmark\s*\$\s*([0-9]+(?:\.[0-9]+)?)/i);
  if (!m?.[1]) {
    return null;
  }
  const n = Number.parseFloat(m[1]);
  return Number.isFinite(n) ? n : null;
}

export function buildSimulateXoptionsHref(input: {
  portfolioId: string;
  accountId: string | null;
  symbol: string | null;
}): string | null {
  const s = (input.symbol ?? "").trim().toUpperCase();
  if (!/^[A-Z0-9.\-]{1,10}$/.test(s)) {
    return null;
  }
  const q = new URLSearchParams({ symbol: s, step: "4" });
  q.set("portfolioId", input.portfolioId.trim());
  const acc = input.accountId?.trim() ?? "";
  if (/^[a-f0-9]{24}$/i.test(acc)) {
    q.set("accountId", acc.toLowerCase());
  }
  return `/xoptions?${q.toString()}`;
}
