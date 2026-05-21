"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { ActivityPulseIcon, DeleteIcon } from "@/app/admin/ui/crud-icons";
import type { SerializablePosition } from "@/app/portfolio/accounts/serializable-account";
import {
    computeHoldingsRowMetrics,
    optionQuoteLookupKey,
    underlyingQuoteLookupKey
} from "@/app/portfolio/lib/holdings-row-metrics";
import { isPositionOptionsChainEligible } from "@/app/portfolio/lib/portfolio-position-options-chain";
import { HoldingsFiftyTwoWeekRange } from "@/app/portfolio/ui/holdings-fifty-two-week-range";
import { PortfolioSymbolMark } from "@/app/portfolio/ui/portfolio-symbol-mark";
import { PositionOptionsChainDrawer } from "@/app/portfolio/ui/position-options-chain-drawer";
import { useSymbolQuotes } from "@/app/portfolio/ui/use-symbol-quotes";
import { XoptionsRocketIcon } from "@/app/ui/lucide-product-icons";
import { RailSidebarZapIcon } from "@/app/ui/rail-sidebar-zap-icon";
import { isLikelyMongoObjectIdHex } from "@/lib/mongo-object-id-hex";
import {
    buildPortfolioDeskXchatPrompt,
    buildPositionDeskHandoffUrls
} from "@/lib/portfolio/portfolio-desk-handoff";
import { writePortfolioDeskXchatHandoff } from "@/lib/portfolio/portfolio-desk-xchat-handoff";
import { REAL_ESTATE_HOLDING_DISCLAIMER } from "@/lib/real-estate-holding-form";
import {
    dispatchWorkspaceAccountChanged,
    writeStoredWorkspaceAccountId
} from "@/lib/workspace-account-selection";
import { realEstateValuationSourceLabel } from "@/modules/core-admin/types";
import type { SymbolLookupResult } from "@/modules/watchlist/yahoo-symbol-lookup";

function fmtUsd(n: number): string {
  return n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 2 });
}

function fmtPct(n: number): string {
  return `${n >= 0 ? "+" : ""}${n.toFixed(2)}%`;
}

function fmtSignedUsd(n: number): string {
  if (n > 0) {
    return `+${fmtUsd(n)}`;
  }
  return fmtUsd(n);
}

function gainLossClass(n: number | null): string {
  if (n == null || !Number.isFinite(n) || n === 0) {
    return "value-neutral portfolio-consolidated-holdings__mono";
  }
  return n > 0
    ? "value-gain portfolio-consolidated-holdings__mono"
    : "value-loss portfolio-consolidated-holdings__mono";
}

function optionLegLabel(p: SerializablePosition & { type: "option" }): string {
  const exp = p.expiration.trim();
  let expDisp = exp;
  if (/^\d{4}-\d{2}-\d{2}$/.test(exp)) {
    const d = new Date(`${exp}T12:00:00Z`);
    if (!Number.isNaN(d.getTime())) {
      expDisp = d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
    }
  }
  const cp = p.optionType === "put" ? "Put" : "Call";
  return `${p.contracts} ${cp} ${expDisp} @ ${p.strike}`;
}

function defaultDeskAlertTitle(underlyingUpper: string, p: SerializablePosition): string {
  if (p.type === "option") {
    return `${underlyingUpper} — option leg (holdings)`;
  }
  return `${underlyingUpper} — holdings watch`;
}

function defaultDeskAlertBody(
  p: SerializablePosition,
  underlying: string,
  q: SymbolLookupResult | null,
  markUsd: number
): string {
  const lines: string[] = [];
  lines.push("Source: Edit Account holdings");
  lines.push(`Underlying: ${underlying}`);
  if (q?.price != null && Number.isFinite(q.price)) {
    lines.push(`Last (underlying): ${fmtUsd(q.price)}`);
  } else {
    lines.push("Last (underlying): —");
  }
  if (p.type === "stock") {
    lines.push(`Shares: ${p.shares}`);
    lines.push(`Avg cost / share: ${fmtUsd(p.purchasePrice)}`);
  } else if (p.type === "option") {
    lines.push(optionLegLabel(p));
    lines.push(`Premium / contract: ${fmtUsd(p.premiumPerContract)}`);
    lines.push(`Book value (approx): ${fmtUsd(markUsd)}`);
    if (p.yahooRef?.trim()) {
      lines.push(`Yahoo ref: ${p.yahooRef.trim()}`);
    }
  }
  lines.push("Compare Last vs Avg cost for scanner baselines or manual review.");
  return lines.join("\n");
}

type HoldingsSortColumn = "symbol" | "dayChange" | "qty";

function formatRealEstateValuationDate(iso: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) {
    return iso.trim() || "—";
  }
  const d = new Date(`${iso}T12:00:00Z`);
  if (Number.isNaN(d.getTime())) {
    return "—";
  }
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function symbolSortKey(p: SerializablePosition): string {
  if (p.type === "real_estate") {
    return p.holdingName.trim().toUpperCase();
  }
  if (p.type === "cash") {
    return (p.label.trim() || "CASH").toUpperCase();
  }
  return p.symbol.trim().toUpperCase();
}

function qtySortValue(p: SerializablePosition): number {
  if (p.type === "stock") {
    return p.shares;
  }
  if (p.type === "option") {
    return p.contracts;
  }
  return 1;
}

/** Prefer % change when present (matches primary Day Δ emphasis); else dollar change. */
function dayChangeSortValue(
  p: SerializablePosition,
  quotes: Record<string, SymbolLookupResult | null>
): number | null {
  const key = p.type === "option" ? optionQuoteLookupKey(p) : underlyingQuoteLookupKey(p);
  if (!key) {
    return null;
  }
  const q = quotes[key];
  if (!q) {
    return null;
  }
  if (q.changePercent != null && Number.isFinite(q.changePercent)) {
    return q.changePercent;
  }
  if (q.change != null && Number.isFinite(q.change)) {
    return q.change;
  }
  return null;
}

/**
 * Ascending-order comparison (negative ⇒ a before b). Missing day-change rows sort last for both directions.
 */
function compareHoldingsRows(
  a: SerializablePosition,
  b: SerializablePosition,
  col: HoldingsSortColumn,
  quotes: Record<string, SymbolLookupResult | null>
): number {
  if (col === "symbol") {
    return symbolSortKey(a).localeCompare(symbolSortKey(b), undefined, { sensitivity: "base" });
  }
  if (col === "qty") {
    return qtySortValue(a) - qtySortValue(b);
  }
  const va = dayChangeSortValue(a, quotes);
  const vb = dayChangeSortValue(b, quotes);
  const aMiss = va == null || !Number.isFinite(va);
  const bMiss = vb == null || !Number.isFinite(vb);
  if (aMiss && bMiss) {
    return 0;
  }
  if (aMiss) {
    return 1;
  }
  if (bMiss) {
    return -1;
  }
  return va! - vb!;
}

type AccountConsolidatedHoldingsTableProps = {
  positions: SerializablePosition[];
  pending: boolean;
  onRemove: (positionId: string) => void;
  portfolioIdHex?: string;
  /** When set with `portfolioIdHex`, rows get a **Desk alert** action (POST `/api/portfolios/.../alerts`). */
  accountIdHex?: string;
  onDeskAlertSaved?: () => void;
  /** Broker-style account caption above the grid (e.g. custodian account name). */
  accountLabel?: string | null;
  portfolioName?: string | null;
};

type HoldingsSortState = { col: HoldingsSortColumn; dir: "asc" | "desc" };

type HoldingsSortHeaderProps = {
  col: HoldingsSortColumn;
  label: string;
  sub?: string;
  alignEnd?: boolean;
  sort: HoldingsSortState | null;
  onSort: (c: HoldingsSortColumn) => void;
};

function HoldingsSortHeader({ col, label, sub, alignEnd, sort, onSort }: HoldingsSortHeaderProps) {
  const active = sort?.col === col;
  const dir = sort?.dir ?? "asc";
  const ariaSort = active ? (dir === "asc" ? "ascending" : "descending") : "none";
  return (
    <th
      scope="col"
      aria-sort={ariaSort}
      className={
        alignEnd
          ? "portfolio-consolidated-holdings__num portfolio-consolidated-holdings__th--sortable"
          : "portfolio-consolidated-holdings__th--sortable"
      }
    >
      <button
        type="button"
        className={`portfolio-consolidated-holdings__sort-btn${alignEnd ? " portfolio-consolidated-holdings__sort-btn--end" : ""}`}
        aria-label={
          active
            ? `${label}: sorted ${dir === "asc" ? "ascending" : "descending"}. Activate to reverse order.`
            : `Sort by ${label}`
        }
        onClick={() => onSort(col)}
      >
        <span className="portfolio-consolidated-holdings__sort-btn__main">
          <span>{label}</span>
          {active ? (
            <span className="portfolio-consolidated-holdings__sort-indicator" aria-hidden>
              {dir === "asc" ? "↑" : "↓"}
            </span>
          ) : null}
        </span>
        {sub ? <span className="portfolio-consolidated-holdings__th-sub">{sub}</span> : null}
      </button>
    </th>
  );
}

export function AccountConsolidatedHoldingsTable({
  positions,
  pending,
  onRemove,
  portfolioIdHex,
  accountIdHex,
  onDeskAlertSaved,
  accountLabel = null,
  portfolioName = null
}: AccountConsolidatedHoldingsTableProps) {
  const quoteSymbols = useMemo(() => {
    const s = new Set<string>();
    for (const p of positions) {
      const u = underlyingQuoteLookupKey(p);
      if (u) s.add(u);
      const optionQuote = optionQuoteLookupKey(p);
      if (optionQuote) s.add(optionQuote);
    }
    return [...s];
  }, [positions]);

  const { quotes, loading } = useSymbolQuotes(quoteSymbols, { portfolioIdHex });

  const [sort, setSort] = useState<HoldingsSortState | null>(null);

  const deskDialogRef = useRef<HTMLDialogElement>(null);
  const [deskCtx, setDeskCtx] = useState<{
    position: SerializablePosition;
    underlying: string;
    quote: SymbolLookupResult | null;
    markUsd: number;
  } | null>(null);
  const [deskTitle, setDeskTitle] = useState("");
  const [deskBody, setDeskBody] = useState("");
  const [deskSeverity, setDeskSeverity] = useState<"info" | "warning" | "critical">("info");
  const [deskBusy, setDeskBusy] = useState(false);
  const [deskError, setDeskError] = useState<string | null>(null);
  const [chainPosition, setChainPosition] = useState<SerializablePosition | null>(null);

  const syncWorkspaceAccount = useCallback(() => {
    if (!portfolioIdHex || !accountIdHex) {
      return;
    }
    if (!isLikelyMongoObjectIdHex(portfolioIdHex) || !isLikelyMongoObjectIdHex(accountIdHex)) {
      return;
    }
    writeStoredWorkspaceAccountId(portfolioIdHex, accountIdHex);
    dispatchWorkspaceAccountChanged({ portfolioId: portfolioIdHex, accountId: accountIdHex });
  }, [portfolioIdHex, accountIdHex]);

  const preparePositionXchatHandoff = useCallback(
    (symbol: string) => {
      syncWorkspaceAccount();
      writePortfolioDeskXchatHandoff(
        buildPortfolioDeskXchatPrompt({
          accountName: accountLabel?.trim() || "this account",
          portfolioName,
          symbol
        })
      );
    },
    [accountLabel, portfolioName, syncWorkspaceAccount]
  );

  useEffect(() => {
    if (deskCtx && deskDialogRef.current) {
      deskDialogRef.current.showModal();
    }
  }, [deskCtx]);

  const openDeskDialog = useCallback(
    (
      p: SerializablePosition,
      underlying: string,
      quote: SymbolLookupResult | null,
      markUsd: number
    ) => {
      const u = underlying.trim().toUpperCase();
      setDeskError(null);
      setDeskTitle(defaultDeskAlertTitle(u, p));
      setDeskBody(defaultDeskAlertBody(p, u, quote, markUsd));
      setDeskSeverity("info");
      setDeskCtx({ position: p, underlying: u, quote, markUsd });
    },
    []
  );

  const closeDeskDialog = useCallback(() => {
    deskDialogRef.current?.close();
    setDeskCtx(null);
  }, []);

  async function submitDeskAlert() {
    if (!portfolioIdHex || !accountIdHex || !deskCtx) {
      return;
    }
    setDeskError(null);
    setDeskBusy(true);
    try {
      const sym =
        deskCtx.position.type === "stock" || deskCtx.position.type === "option"
          ? deskCtx.underlying
          : undefined;
      const res = await fetch(
        `/api/portfolios/${encodeURIComponent(portfolioIdHex)}/alerts`,
        {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title: deskTitle.trim(),
            body: deskBody.trim() || undefined,
            severity: deskSeverity,
            symbol: sym,
            accountId: accountIdHex
          })
        }
      );
      const payload = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setDeskError(payload.error ?? "Could not save alert");
        return;
      }
      closeDeskDialog();
      onDeskAlertSaved?.();
    } finally {
      setDeskBusy(false);
    }
  }

  const setSortColumn = useCallback((col: HoldingsSortColumn) => {
    setSort((prev) => {
      if (prev?.col === col) {
        return { col, dir: prev.dir === "asc" ? "desc" : "asc" };
      }
      return { col, dir: "asc" };
    });
  }, []);

  const sortedPositions = useMemo(() => {
    if (!sort) {
      return positions;
    }
    const mult = sort.dir === "asc" ? 1 : -1;
    return [...positions].sort((a, b) => mult * compareHoldingsRows(a, b, sort.col, quotes));
  }, [positions, sort, quotes]);

  const accountTotals = useMemo(() => {
    let currentValueUsd = 0;
    let dayGainUsd = 0;
    let totalGainUsd = 0;
    let hasDayGain = false;
    let hasTotalGain = false;
    for (const p of positions) {
      const metrics = computeHoldingsRowMetrics(p, quotes);
      currentValueUsd += metrics.currentValueUsd;
      if (metrics.dayGainUsd != null && Number.isFinite(metrics.dayGainUsd)) {
        dayGainUsd += metrics.dayGainUsd;
        hasDayGain = true;
      }
      if (metrics.totalGainUsd != null && Number.isFinite(metrics.totalGainUsd)) {
        totalGainUsd += metrics.totalGainUsd;
        hasTotalGain = true;
      }
    }
    return {
      currentValueUsd,
      dayGainUsd: hasDayGain ? dayGainUsd : null,
      totalGainUsd: hasTotalGain ? totalGainUsd : null
    };
  }, [positions, quotes]);

  const showDeskActionsCol = Boolean(portfolioIdHex && accountIdHex);
  const hasRealEstateHoldings = positions.some((p) => p.type === "real_estate");

  return (
    <>
      {accountLabel?.trim() ? (
        <p className="portfolio-consolidated-holdings__account-caption">{accountLabel.trim()}</p>
      ) : null}
      <div className="portfolio-consolidated-holdings__scroll">
        <table className="portfolio-consolidated-holdings">
          <thead>
            <tr>
              <HoldingsSortHeader col="symbol" label="Symbol" sort={sort} onSort={setSortColumn} />
              <th scope="col" className="portfolio-consolidated-holdings__num">
                {hasRealEstateHoldings ? "Valuation / price" : "Last price"}
              </th>
              <th scope="col" className="portfolio-consolidated-holdings__num">
                Last chg
              </th>
              <HoldingsSortHeader
                alignEnd
                col="dayChange"
                label="Today $"
                sort={sort}
                onSort={setSortColumn}
              />
              <th scope="col" className="portfolio-consolidated-holdings__num">
                Today %
              </th>
              <th scope="col" className="portfolio-consolidated-holdings__num">
                Total $
              </th>
              <th scope="col" className="portfolio-consolidated-holdings__num">
                Total %
              </th>
              <th scope="col" className="portfolio-consolidated-holdings__num">
                Current value
              </th>
              <th scope="col" className="portfolio-consolidated-holdings__num">
                % acct
              </th>
              <HoldingsSortHeader alignEnd col="qty" label="Qty" sort={sort} onSort={setSortColumn} />
              <th scope="col" className="portfolio-consolidated-holdings__num">
                Avg cost
              </th>
              <th scope="col" className="portfolio-consolidated-holdings__num">
                Cost basis
              </th>
              <th scope="col" className="portfolio-consolidated-holdings__range-col">
                52-week range
              </th>
              {showDeskActionsCol ? (
                <th scope="col" className="portfolio-consolidated-holdings__th-desk">
                  Desk
                  <span className="portfolio-consolidated-holdings__th-sub">alert · xOptions · xChat</span>
                </th>
              ) : null}
              <th scope="col" aria-label="Remove" />
            </tr>
          </thead>
          <tbody>
            {sortedPositions.map((p) => {
              const u = underlyingQuoteLookupKey(p);
              const q = u ? quotes[u] ?? null : null;
              const metrics = computeHoldingsRowMetrics(p, quotes);
              const isRealEstate = p.type === "real_estate";
              const showQuote = !isRealEstate && (p.type === "stock" || p.type === "option");
              const pct =
                accountTotals.currentValueUsd > 0
                  ? (metrics.currentValueUsd / accountTotals.currentValueUsd) * 100
                  : 0;
              const wkLo = q?.fiftyTwoWeekLow;
              const wkHi = q?.fiftyTwoWeekHigh;
              const has52w =
                p.type === "stock" &&
                typeof wkLo === "number" &&
                Number.isFinite(wkLo) &&
                typeof wkHi === "number" &&
                Number.isFinite(wkHi);

              const symCell =
                isRealEstate ? (
                  <div className="portfolio-consolidated-holdings__sym-stack">
                    <div className="portfolio-consolidated-holdings__sym">
                      <span className="portfolio-consolidated-holdings__sym-icon--re" aria-hidden>
                        ⌂
                      </span>
                      <span className="portfolio-consolidated-holdings__sym-ticker">{p.holdingName}</span>
                      <span className="portfolio-consolidated-holdings__illiquid-badge">Illiquid</span>
                    </div>
                    <span className="portfolio-consolidated-holdings__sym-sub">
                      {p.metadata?.address?.trim() || "Real estate · manual valuation"}
                      {p.lastValuationDate ? ` · Last updated ${formatRealEstateValuationDate(p.lastValuationDate)}` : ""}
                    </span>
                    <p className="portfolio-re-holding-row__disclaimer" role="note">
                      {REAL_ESTATE_HOLDING_DISCLAIMER}
                    </p>
                  </div>
                ) : p.type === "cash" ? (
                  <div className="portfolio-consolidated-holdings__sym-stack">
                    <span className="portfolio-consolidated-holdings__sym-ticker">{p.label}</span>
                    <span className="portfolio-consolidated-holdings__sym-sub">Cash / sweep</span>
                  </div>
                ) : showQuote && u ? (
                  <div className="portfolio-consolidated-holdings__sym-stack">
                    <div className="portfolio-consolidated-holdings__sym">
                      <PortfolioSymbolMark logoUrl={q?.logoUrl} symbol={u} title={q?.companyName ?? u} size={22} />
                      <span className="portfolio-consolidated-holdings__sym-ticker">
                        {p.type === "option"
                          ? `${u} ${p.strike} ${p.optionType === "put" ? "Put" : "Call"}`
                          : u}
                      </span>
                    </div>
                    {p.type === "option" ? (
                      <span className="portfolio-consolidated-holdings__sym-sub">{optionLegLabel(p)}</span>
                    ) : (
                      <span className="portfolio-consolidated-holdings__sym-sub">{q?.companyName ?? "—"}</span>
                    )}
                  </div>
                ) : (
                  <span className="portfolio-consolidated-holdings__mono">{p.symbol}</span>
                );

              return (
                <tr key={p._id}>
                  <td>{symCell}</td>
                  <td className="portfolio-consolidated-holdings__num">
                    {isRealEstate ? (
                      <span className="portfolio-consolidated-holdings__mono text-[0.72rem]">
                        {formatRealEstateValuationDate(p.lastValuationDate)}
                      </span>
                    ) : loading && showQuote && metrics.lastPrice == null ? (
                      <span className="portfolio-consolidated-holdings__muted">…</span>
                    ) : metrics.lastPrice != null ? (
                      <span className="portfolio-consolidated-holdings__mono">{fmtUsd(metrics.lastPrice)}</span>
                    ) : (
                      <span className="portfolio-consolidated-holdings__muted">—</span>
                    )}
                  </td>
                  <td className="portfolio-consolidated-holdings__num">
                    {metrics.lastChange != null ? (
                      <span className={gainLossClass(metrics.lastChange)}>{fmtSignedUsd(metrics.lastChange)}</span>
                    ) : (
                      <span className="portfolio-consolidated-holdings__muted">—</span>
                    )}
                  </td>
                  <td className="portfolio-consolidated-holdings__num">
                    {metrics.dayGainUsd != null ? (
                      <span className={gainLossClass(metrics.dayGainUsd)}>{fmtSignedUsd(metrics.dayGainUsd)}</span>
                    ) : (
                      <span className="portfolio-consolidated-holdings__muted">—</span>
                    )}
                  </td>
                  <td className="portfolio-consolidated-holdings__num">
                    {metrics.dayGainPct != null ? (
                      <span className={gainLossClass(metrics.dayGainPct)}>{fmtPct(metrics.dayGainPct)}</span>
                    ) : (
                      <span className="portfolio-consolidated-holdings__muted">—</span>
                    )}
                  </td>
                  <td className="portfolio-consolidated-holdings__num">
                    {metrics.totalGainUsd != null ? (
                      <span className={gainLossClass(metrics.totalGainUsd)}>{fmtSignedUsd(metrics.totalGainUsd)}</span>
                    ) : (
                      <span className="portfolio-consolidated-holdings__muted">—</span>
                    )}
                  </td>
                  <td className="portfolio-consolidated-holdings__num">
                    {metrics.totalGainPct != null ? (
                      <span className={gainLossClass(metrics.totalGainPct)}>{fmtPct(metrics.totalGainPct)}</span>
                    ) : (
                      <span className="portfolio-consolidated-holdings__muted">—</span>
                    )}
                  </td>
                  <td className="portfolio-consolidated-holdings__num portfolio-consolidated-holdings__mono">
                    {fmtUsd(metrics.currentValueUsd)}
                    {metrics.usesOptionBookMark ? (
                      <span className="portfolio-consolidated-holdings__foot"> book</span>
                    ) : null}
                  </td>
                  <td className="portfolio-consolidated-holdings__num portfolio-consolidated-holdings__mono">
                    {accountTotals.currentValueUsd > 0 ? `${pct.toFixed(2)}%` : "—"}
                  </td>
                  <td className="portfolio-consolidated-holdings__num">
                    <span className="portfolio-consolidated-holdings__mono">
                      {isRealEstate ? `${metrics.qty.toFixed(0)}% own` : metrics.qty.toLocaleString("en-US")}
                    </span>
                  </td>
                  <td className="portfolio-consolidated-holdings__num">
                    {isRealEstate ? (
                      <span className="portfolio-consolidated-holdings__sym-sub">
                        {realEstateValuationSourceLabel(p.valuationSource)}
                      </span>
                    ) : metrics.avgCost != null ? (
                      <span className="portfolio-consolidated-holdings__mono">
                        {p.type === "option" ? `${fmtUsd(metrics.avgCost)}/ct` : fmtUsd(metrics.avgCost)}
                      </span>
                    ) : (
                      <span className="portfolio-consolidated-holdings__muted">—</span>
                    )}
                  </td>
                  <td className="portfolio-consolidated-holdings__num">
                    <span className="portfolio-consolidated-holdings__mono">{fmtUsd(metrics.costBasisUsd)}</span>
                  </td>
                  <td className="portfolio-consolidated-holdings__range-col">
                    {has52w ? (
                      <HoldingsFiftyTwoWeekRange low={wkLo} high={wkHi} last={metrics.lastPrice} />
                    ) : (
                      <span className="portfolio-consolidated-holdings__muted">—</span>
                    )}
                  </td>
                  {showDeskActionsCol ? (
                    <td className="portfolio-consolidated-holdings__desk">
                      {showQuote && u && portfolioIdHex && accountIdHex ? (
                        <div className="portfolio-consolidated-holdings__desk-actions">
                          <button
                            type="button"
                            className="cta cta-secondary portfolio-consolidated-holdings__desk-btn"
                            disabled={pending}
                            onClick={() => openDeskDialog(p, u, q, metrics.currentValueUsd)}
                            aria-label={`Create desk alert for ${u}`}
                            title="Desk alert"
                          >
                            <ActivityPulseIcon className="crud-icon" aria-hidden />
                          </button>
                          {isPositionOptionsChainEligible(p) ? (
                            <button
                              type="button"
                              className="cta cta-secondary portfolio-consolidated-holdings__desk-btn"
                              disabled={pending}
                              onClick={() => setChainPosition(p)}
                              aria-label={`View options chain for ${u}`}
                              title="View options chain (xOptions)"
                            >
                              <XoptionsRocketIcon
                                className="portfolio-consolidated-holdings__desk-glyph"
                                aria-hidden
                              />
                            </button>
                          ) : null}
                          <Link
                            className="cta cta-secondary portfolio-consolidated-holdings__desk-btn"
                            href={
                              buildPositionDeskHandoffUrls({
                                portfolioIdHex,
                                accountIdHex,
                                symbol: u
                              }).xchatHref
                            }
                            onClick={() => preparePositionXchatHandoff(u)}
                            aria-label={`Ask xChat about ${u}`}
                            title="Ask xChat about this position"
                          >
                            <RailSidebarZapIcon
                              className="portfolio-consolidated-holdings__desk-glyph portfolio-consolidated-holdings__desk-glyph--zap"
                              size="disclosure"
                              aria-hidden
                            />
                          </Link>
                        </div>
                      ) : (
                        <span className="portfolio-consolidated-holdings__muted">—</span>
                      )}
                    </td>
                  ) : null}
                  <td>
                    <button
                      type="button"
                      className="cta cta-secondary portfolio-consolidated-holdings__remove"
                      disabled={pending}
                      onClick={() => onRemove(p._id)}
                    >
                      <DeleteIcon className="crud-icon" aria-hidden />
                      <span className="sr-only">Remove</span>
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
          {positions.length > 0 ? (
            <tfoot>
              <tr className="portfolio-consolidated-holdings__total">
                <th scope="row" colSpan={3} className="portfolio-consolidated-holdings__total-label">
                  Account total
                </th>
                <td className="portfolio-consolidated-holdings__num">
                  {accountTotals.dayGainUsd != null ? (
                    <span className={gainLossClass(accountTotals.dayGainUsd)}>
                      {fmtSignedUsd(accountTotals.dayGainUsd)}
                    </span>
                  ) : (
                    <span className="portfolio-consolidated-holdings__muted">—</span>
                  )}
                </td>
                <td />
                <td className="portfolio-consolidated-holdings__num">
                  {accountTotals.totalGainUsd != null ? (
                    <span className={gainLossClass(accountTotals.totalGainUsd)}>
                      {fmtSignedUsd(accountTotals.totalGainUsd)}
                    </span>
                  ) : (
                    <span className="portfolio-consolidated-holdings__muted">—</span>
                  )}
                </td>
                <td />
                <td className="portfolio-consolidated-holdings__num portfolio-consolidated-holdings__mono">
                  {fmtUsd(accountTotals.currentValueUsd)}
                </td>
                <td className="portfolio-consolidated-holdings__num portfolio-consolidated-holdings__mono">100%</td>
                <td colSpan={showDeskActionsCol ? 6 : 5} />
              </tr>
            </tfoot>
          ) : null}
        </table>
      </div>
      <dialog
        ref={deskDialogRef}
        className="portfolio-alerts-preview-dialog"
        onClose={() => setDeskCtx(null)}
      >
        <form
          className="portfolio-alerts-preview-dialog__inner"
          onSubmit={(e) => {
            e.preventDefault();
            void submitDeskAlert();
          }}
        >
          <h2 className="portfolio-alerts-preview-dialog__title">Save desk alert</h2>
          <p className="portfolio-edit-holdings-card__table-hint" style={{ marginTop: 0 }}>
            Creates an in-app portfolio alert (same list as{" "}
            {portfolioIdHex ? (
              <Link
                className="portfolio-alerts-preview-dialog__link"
                href={`/portfolio/alerts?portfolioId=${encodeURIComponent(portfolioIdHex)}`}
              >
                Alerts
              </Link>
            ) : (
              "Alerts"
            )}
            ). Optional Slack/email still follow delivery channels for this book.
          </p>
          {deskError ? (
            <p className="status-text status-error" role="alert">
              {deskError}
            </p>
          ) : null}
          <label className="stack-gap portfolio-consolidated-holdings__dialog-field">
            <span className="portfolio-edit-field__label">Title</span>
            <input
              className="crud-input"
              value={deskTitle}
              onChange={(e) => setDeskTitle(e.target.value)}
              maxLength={200}
              required
              autoComplete="off"
            />
          </label>
          <label className="stack-gap portfolio-consolidated-holdings__dialog-field">
            <span className="portfolio-edit-field__label">Body</span>
            <textarea
              className="crud-input portfolio-consolidated-holdings__dialog-textarea"
              value={deskBody}
              onChange={(e) => setDeskBody(e.target.value)}
              maxLength={4000}
              rows={8}
            />
          </label>
          <label className="stack-gap portfolio-consolidated-holdings__dialog-field">
            <span className="portfolio-edit-field__label">Severity</span>
            <select
              className="crud-input"
              value={deskSeverity}
              onChange={(e) => setDeskSeverity(e.target.value as "info" | "warning" | "critical")}
              aria-label="Alert severity"
            >
              <option value="info">Info</option>
              <option value="warning">Warning</option>
              <option value="critical">Critical</option>
            </select>
          </label>
          <div className="portfolio-alerts-preview-dialog__footer">
            <button type="button" className="portfolio-alerts-preview-dialog__close" onClick={closeDeskDialog}>
              Cancel
            </button>
            <button type="submit" className="cta cta-primary" disabled={deskBusy}>
              {deskBusy ? "Saving…" : "Save alert"}
            </button>
          </div>
        </form>
      </dialog>
      {portfolioIdHex && accountIdHex ? (
        <PositionOptionsChainDrawer
          accountIdHex={accountIdHex}
          accountLabel={accountLabel?.trim() || "Account"}
          open={chainPosition != null}
          portfolioIdHex={portfolioIdHex}
          position={chainPosition}
          onClose={() => setChainPosition(null)}
        />
      ) : null}
    </>
  );
}
