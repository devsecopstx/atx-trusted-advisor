"use client";

import { useMemo } from "react";

import { DeleteIcon } from "@/app/admin/ui/crud-icons";
import type { SerializablePosition } from "@/app/portfolio/accounts/serializable-account";
import { PortfolioSymbolMark } from "@/app/portfolio/ui/portfolio-symbol-mark";
import { useSymbolQuotes } from "@/app/portfolio/ui/use-symbol-quotes";
import type { SymbolLookupResult } from "@/modules/watchlist/yahoo-symbol-lookup";

function fmtUsd(n: number): string {
  return n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 2 });
}

function fmtPct(n: number): string {
  return `${n >= 0 ? "+" : ""}${n.toFixed(2)}%`;
}

function underlyingSymbol(p: SerializablePosition): string | null {
  if (p.type === "stock" || p.type === "option") {
    return p.symbol.trim().toUpperCase();
  }
  return null;
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

/** Mark-to-model for one row (stocks use live last when available; options use book; cash = notional). */
function rowMarkUsd(p: SerializablePosition, quotes: Record<string, SymbolLookupResult | null>): number {
  if (p.type === "cash") {
    return Math.max(0, p.amount);
  }
  if (p.type === "stock") {
    const u = p.symbol.trim().toUpperCase();
    const last = quotes[u]?.price;
    if (last != null && Number.isFinite(last)) {
      return p.shares * last;
    }
    return p.shares * p.purchasePrice;
  }
  return Math.abs(p.contracts) * 100 * p.premiumPerContract;
}

type AccountConsolidatedHoldingsTableProps = {
  positions: SerializablePosition[];
  pending: boolean;
  onRemove: (positionId: string) => void;
  portfolioIdHex?: string;
};

export function AccountConsolidatedHoldingsTable({
  positions,
  pending,
  onRemove,
  portfolioIdHex
}: AccountConsolidatedHoldingsTableProps) {
  const quoteSymbols = useMemo(() => {
    const s = new Set<string>();
    for (const p of positions) {
      const u = underlyingSymbol(p);
      if (u) s.add(u);
    }
    return [...s];
  }, [positions]);

  const { quotes, loading } = useSymbolQuotes(quoteSymbols, { portfolioIdHex });

  const totalMark = useMemo(() => {
    let t = 0;
    for (const p of positions) {
      t += rowMarkUsd(p, quotes);
    }
    return t;
  }, [positions, quotes]);

  return (
    <div className="portfolio-consolidated-holdings__scroll">
      <table className="portfolio-consolidated-holdings">
        <thead>
          <tr>
            <th scope="col">Symbol</th>
            <th scope="col">Position</th>
            <th scope="col" className="portfolio-consolidated-holdings__num">
              Last
              <span className="portfolio-consolidated-holdings__th-sub">underlying</span>
            </th>
            <th scope="col" className="portfolio-consolidated-holdings__num">
              Day Δ
            </th>
            <th scope="col" className="portfolio-consolidated-holdings__num">
              Value
            </th>
            <th scope="col" className="portfolio-consolidated-holdings__num">
              % acct
            </th>
            <th scope="col" className="portfolio-consolidated-holdings__num">
              Qty
            </th>
            <th scope="col" className="portfolio-consolidated-holdings__num">
              Avg cost
            </th>
            <th scope="col" aria-label="Remove" />
          </tr>
        </thead>
        <tbody>
          {positions.map((p) => {
            const u = underlyingSymbol(p);
            const q = u ? quotes[u] ?? null : null;
            const showQuote = p.type === "stock" || p.type === "option";
            const mark = rowMarkUsd(p, quotes);
            const pct = totalMark > 0 ? (mark / totalMark) * 100 : 0;

            const lastCell =
              showQuote && u ? (
                loading && !q ? (
                  <span className="portfolio-consolidated-holdings__muted">…</span>
                ) : q?.price != null && Number.isFinite(q.price) ? (
                  <span className="portfolio-consolidated-holdings__mono">
                    {fmtUsd(q.price)}
                  </span>
                ) : (
                  <span className="portfolio-consolidated-holdings__muted">—</span>
                )
              ) : (
                <span className="portfolio-consolidated-holdings__muted">—</span>
              );

            const dayCell =
              showQuote && u ? (
                loading && !q ? (
                  <span className="portfolio-consolidated-holdings__muted">…</span>
                ) : q?.change != null && Number.isFinite(q.change) ? (
                  <span
                    className={
                      q.change > 0
                        ? "value-gain portfolio-consolidated-holdings__mono"
                        : q.change < 0
                          ? "value-loss portfolio-consolidated-holdings__mono"
                          : "value-neutral portfolio-consolidated-holdings__mono"
                    }
                  >
                    {fmtUsd(q.change)}
                    {q.changePercent != null && Number.isFinite(q.changePercent) ? (
                      <span className="portfolio-consolidated-holdings__day-pct">
                        {" "}
                        ({fmtPct(q.changePercent)})
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
              <td colSpan={3} />
            </tr>
          </tfoot>
        ) : null}
      </table>
    </div>
  );
}
