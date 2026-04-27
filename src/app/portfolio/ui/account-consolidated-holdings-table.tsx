"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { ActivityPulseIcon, DeleteIcon } from "@/app/admin/ui/crud-icons";
import type { SerializablePosition } from "@/app/portfolio/accounts/serializable-account";
import { PortfolioSymbolMark } from "@/app/portfolio/ui/portfolio-symbol-mark";
import { useSymbolQuotes } from "@/app/portfolio/ui/use-symbol-quotes";
import { parseOccOptionSymbol, underlyingForYahooOptionsChain } from "@/modules/watchlist/option-expiration";
import type { SymbolLookupResult } from "@/modules/watchlist/yahoo-symbol-lookup";

function fmtUsd(n: number): string {
  return n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 2 });
}

function fmtPct(n: number): string {
  return `${n >= 0 ? "+" : ""}${n.toFixed(2)}%`;
}

/** Equity root for Yahoo batch quotes + equity logos (OCC option lines → underlying). */
function underlyingQuoteLookupKey(p: SerializablePosition): string | null {
  if (p.type === "stock" || p.type === "option") {
    return underlyingForYahooOptionsChain(p.symbol);
  }
  return null;
}

/** Option contract quote key for Last/Day on option rows. */
function normalizeOptionContractQuoteKey(raw: string): string | null {
  const upper = raw.trim().toUpperCase();
  if (!upper) {
    return null;
  }
  const withoutPrefix = upper.startsWith("O:") ? upper.slice(2) : upper;
  return parseOccOptionSymbol(withoutPrefix) ? withoutPrefix : null;
}

/** Option contract quote key for Last/Day on option rows. */
function optionQuoteLookupKey(p: SerializablePosition): string | null {
  if (p.type !== "option") {
    return null;
  }
  const explicitYahooRef = normalizeOptionContractQuoteKey(p.yahooRef);
  if (explicitYahooRef) {
    return explicitYahooRef;
  }
  const occInSymbol = normalizeOptionContractQuoteKey(p.symbol);
  if (occInSymbol) {
    return occInSymbol;
  }
  const upperSymbol = p.symbol.trim().toUpperCase();
  const underlying = underlyingForYahooOptionsChain(upperSymbol).trim().toUpperCase();
  if (!underlying || !/^\d{4}-\d{2}-\d{2}$/.test(p.expiration) || !Number.isFinite(p.strike) || p.strike <= 0) {
    return null;
  }
  const expCompact = p.expiration.replaceAll("-", "").slice(2);
  const typeChar = p.optionType === "put" ? "P" : "C";
  const strikeCompact = String(Math.round(p.strike * 1000)).padStart(8, "0");
  return `${underlying}${expCompact}${typeChar}${strikeCompact}`;
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

/** Mark-to-model for one row (stocks use live last when available; options use book; cash = notional). */
function rowMarkUsd(p: SerializablePosition, quotes: Record<string, SymbolLookupResult | null>): number {
  if (p.type === "cash") {
    return Math.max(0, p.amount);
  }
  if (p.type === "stock") {
    const u = underlyingQuoteLookupKey(p);
    if (!u) {
      return p.shares * p.purchasePrice;
    }
    const last = quotes[u]?.price;
    if (last != null && Number.isFinite(last)) {
      return p.shares * last;
    }
    return p.shares * p.purchasePrice;
  }
  return Math.abs(p.contracts) * 100 * p.premiumPerContract;
}

type HoldingsSortColumn = "symbol" | "dayChange" | "qty";

function symbolSortKey(p: SerializablePosition): string {
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
  onDeskAlertSaved
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

  const totalMark = useMemo(() => {
    let t = 0;
    for (const p of positions) {
      t += rowMarkUsd(p, quotes);
    }
    return t;
  }, [positions, quotes]);

  const showDeskAlertCol = Boolean(portfolioIdHex && accountIdHex);

  return (
    <>
      <div className="portfolio-consolidated-holdings__scroll">
        <table className="portfolio-consolidated-holdings">
          <thead>
            <tr>
              <HoldingsSortHeader col="symbol" label="Symbol" sort={sort} onSort={setSortColumn} />
              <th scope="col">Position</th>
              <th scope="col" className="portfolio-consolidated-holdings__num">
                Last
                <span className="portfolio-consolidated-holdings__th-sub">quote</span>
              </th>
              <HoldingsSortHeader
                alignEnd
                col="dayChange"
                label="Day Δ"
                sort={sort}
                onSort={setSortColumn}
              />
              <th scope="col" className="portfolio-consolidated-holdings__num">
                Value
              </th>
              <th scope="col" className="portfolio-consolidated-holdings__num">
                % acct
              </th>
              <HoldingsSortHeader alignEnd col="qty" label="Qty" sort={sort} onSort={setSortColumn} />
              <th scope="col" className="portfolio-consolidated-holdings__num">
                Avg cost
              </th>
              {showDeskAlertCol ? (
                <th scope="col" className="portfolio-consolidated-holdings__th-desk">
                  Desk
                  <span className="portfolio-consolidated-holdings__th-sub">alert</span>
                </th>
              ) : null}
              <th scope="col" aria-label="Remove" />
            </tr>
          </thead>
        <tbody>
          {sortedPositions.map((p) => {
            const u = underlyingQuoteLookupKey(p);
            const q = u ? quotes[u] ?? null : null;
            const optionQuoteKey = optionQuoteLookupKey(p);
            const optionQuote = optionQuoteKey ? quotes[optionQuoteKey] ?? null : null;
            const displayQuote = p.type === "option" ? optionQuote : q;
            const showQuote = p.type === "stock" || p.type === "option";
            const mark = rowMarkUsd(p, quotes);
            const pct = totalMark > 0 ? (mark / totalMark) * 100 : 0;

            const lastCell =
              showQuote && u ? (
                loading && !displayQuote ? (
                  <span className="portfolio-consolidated-holdings__muted">…</span>
                ) : displayQuote?.price != null && Number.isFinite(displayQuote.price) ? (
                  <span className="portfolio-consolidated-holdings__mono">
                    {fmtUsd(displayQuote.price)}
                  </span>
                ) : (
                  <span className="portfolio-consolidated-holdings__muted">—</span>
                )
              ) : (
                <span className="portfolio-consolidated-holdings__muted">—</span>
              );

            const dayCell =
              showQuote && u ? (
                loading && !displayQuote ? (
                  <span className="portfolio-consolidated-holdings__muted">…</span>
                ) : displayQuote?.change != null && Number.isFinite(displayQuote.change) ? (
                  <span
                    className={
                      displayQuote.change > 0
                        ? "value-gain portfolio-consolidated-holdings__mono"
                        : displayQuote.change < 0
                          ? "value-loss portfolio-consolidated-holdings__mono"
                          : "value-neutral portfolio-consolidated-holdings__mono"
                    }
                  >
                    {fmtUsd(displayQuote.change)}
                    {displayQuote.changePercent != null && Number.isFinite(displayQuote.changePercent) ? (
                      <span className="portfolio-consolidated-holdings__day-pct">
                        {" "}
                        ({fmtPct(displayQuote.changePercent)})
                      </span>
                    ) : null}
                  </span>
                ) : (
                  <span className="portfolio-consolidated-holdings__muted">—</span>
                )
              ) : (
                <span className="portfolio-consolidated-holdings__muted">—</span>
              );

            const qtyCell =
              p.type === "stock" ? (
                <span className="portfolio-consolidated-holdings__mono">{p.shares}</span>
              ) : p.type === "option" ? (
                <span className="portfolio-consolidated-holdings__mono">{p.contracts}</span>
              ) : (
                <span className="portfolio-consolidated-holdings__muted">1</span>
              );

            const avgCell =
              p.type === "stock" ? (
                <span className="portfolio-consolidated-holdings__mono">{fmtUsd(p.purchasePrice)}</span>
              ) : p.type === "option" ? (
                <span className="portfolio-consolidated-holdings__mono">{fmtUsd(p.premiumPerContract)}/ct</span>
              ) : (
                <span className="portfolio-consolidated-holdings__mono">{fmtUsd(p.amount)}</span>
              );

            const symCell =
              showQuote && u ? (
                <div className="portfolio-consolidated-holdings__sym">
                  <PortfolioSymbolMark logoUrl={q?.logoUrl} symbol={u} title={q?.companyName ?? u} size={28} />
                  <span className="portfolio-consolidated-holdings__sym-ticker">{u}</span>
                </div>
              ) : (
                <span className="portfolio-consolidated-holdings__mono">{p.type === "cash" ? p.label : p.symbol}</span>
              );

            const posCell =
              p.type === "option" ? (
                <div className="portfolio-consolidated-holdings__leg">
                  <span className="portfolio-consolidated-holdings__leg-main">{optionLegLabel(p)}</span>
                  {p.yahooRef ? (
                    <span className="portfolio-consolidated-holdings__leg-ref">{p.yahooRef}</span>
                  ) : null}
                </div>
              ) : p.type === "stock" ? (
                <span className="portfolio-consolidated-holdings__muted">{q?.companyName ?? "—"}</span>
              ) : (
                <span className="portfolio-consolidated-holdings__muted">Cash / sweep</span>
              );

            return (
              <tr key={p._id}>
                <td>{symCell}</td>
                <td>{posCell}</td>
                <td className="portfolio-consolidated-holdings__num">{lastCell}</td>
                <td className="portfolio-consolidated-holdings__num">{dayCell}</td>
                <td className="portfolio-consolidated-holdings__num portfolio-consolidated-holdings__mono">
                  {fmtUsd(mark)}
                  {p.type === "option" ? (
                    <span className="portfolio-consolidated-holdings__foot"> book</span>
                  ) : null}
                </td>
                <td className="portfolio-consolidated-holdings__num portfolio-consolidated-holdings__mono">
                  {totalMark > 0 ? `${pct.toFixed(1)}%` : "—"}
                </td>
                <td className="portfolio-consolidated-holdings__num">{qtyCell}</td>
                <td className="portfolio-consolidated-holdings__num">{avgCell}</td>
                {showDeskAlertCol ? (
                  <td className="portfolio-consolidated-holdings__desk">
                    {showQuote && u ? (
                      <button
                        type="button"
                        className="cta cta-secondary portfolio-consolidated-holdings__desk-btn"
                        disabled={pending}
                        onClick={() => openDeskDialog(p, u, q, mark)}
                        aria-label={`Create desk alert for ${u}`}
                      >
                        <ActivityPulseIcon className="crud-icon" aria-hidden />
                      </button>
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
                <th scope="row" colSpan={4} className="portfolio-consolidated-holdings__total-label">
                  Total (mark)
                </th>
                <td className="portfolio-consolidated-holdings__num portfolio-consolidated-holdings__mono">
                  {fmtUsd(totalMark)}
                </td>
                <td className="portfolio-consolidated-holdings__num portfolio-consolidated-holdings__mono">100%</td>
                <td colSpan={showDeskAlertCol ? 4 : 3} />
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
    </>
  );
}
