"use client";

import Link from "next/link";
import { useMemo } from "react";

import type { PortfolioHoldingRow } from "@/lib/portfolio-holding-rows";
import { formatUsdWhole } from "@/lib/portfolio-overview-metrics";

import { PortfolioSymbolMark } from "@/app/portfolio/ui/portfolio-symbol-mark";
import { useSymbolQuotes } from "@/app/portfolio/ui/use-symbol-quotes";

type PortfolioHoldingsPanelProps = {
  rows: PortfolioHoldingRow[];
  portfolioIdHex: string;
  /** When set, only rows for this account are shown (e.g. selected account on /portfolio). */
  filterAccountIdHex?: string;
};

export function PortfolioHoldingsPanel({ rows, portfolioIdHex, filterAccountIdHex }: PortfolioHoldingsPanelProps) {
  const visibleRows = useMemo(() => {
    if (!filterAccountIdHex) return rows;
    return rows.filter((r) => r.accountIdHex === filterAccountIdHex);
  }, [rows, filterAccountIdHex]);

  const quoteSymbols = useMemo(() => {
    const s = new Set<string>();
    for (const r of visibleRows) {
      if (r.positionType === "stock" || r.positionType === "option") {
        s.add(r.symbol.trim().toUpperCase());
      }
    }
    return [...s];
  }, [visibleRows]);

  const { quotes, loading } = useSymbolQuotes(quoteSymbols, { portfolioIdHex });

  const hint = filterAccountIdHex
    ? "Cost basis and live marks for the selected account. Add or remove lots in the card below."
    : "Cost basis book values; live marks where shown. Edit lots from each account page.";

  return (
    <section className="portfolio-panel portfolio-holdings-panel" aria-labelledby="portfolio-all-holdings-heading">
      <h2 className="portfolio-panel__title" id="portfolio-all-holdings-heading">
        {filterAccountIdHex ? "Holdings (selected account)" : "Holdings"}
      </h2>
      <p className="portfolio-holdings-panel__hint">{hint}</p>
      {visibleRows.length === 0 ? (
        <p className="status-text">
          {filterAccountIdHex
            ? "No positions for this account yet — use the form below to add stock, options, or cash."
            : "No positions yet — open an account from Overview, use the Holdings tab, and add stock, options, or cash there."}
        </p>
      ) : (
        <div className="portfolio-table-wrap">
          <table className="portfolio-manage-table">
            <thead>
              <tr>
                <th scope="col">Account</th>
                <th scope="col">Type</th>
                <th scope="col">Symbol</th>
                <th scope="col">Last (live)</th>
                <th scope="col">Details</th>
                <th scope="col">Book value</th>
                <th scope="col">Actions</th>
              </tr>
            </thead>
            <tbody>
              {visibleRows.map((r, i) => {
                const sym = r.symbol.trim().toUpperCase();
                const showQuote = r.positionType === "stock" || r.positionType === "option";
                const q = showQuote ? quotes[sym] : null;
                return (
                  <tr key={`${r.accountIdHex}-${r.symbol}-${i}`}>
                    <td>{r.accountName}</td>
                    <td className="portfolio-manage-table__mono">{r.positionType}</td>
                    <td>
                      {showQuote ? (
                        <div className="portfolio-holding-live-sym">
                          <PortfolioSymbolMark
                            logoUrl={q?.logoUrl}
                            size={28}
                            symbol={sym}
                            title={q?.companyName ?? sym}
                          />
                          <span className="portfolio-holding-live-sym__ticker portfolio-manage-table__mono">{sym}</span>
                        </div>
                      ) : (
                        <span className="portfolio-manage-table__mono">{r.symbol}</span>
                      )}
                    </td>
                    <td className="portfolio-manage-table__num">
                      {showQuote ? (
                        loading && !q ? (
                          <span className="portfolio-stock-live-hint__muted">…</span>
                        ) : q?.price !== undefined && Number.isFinite(q.price) ? (
                          <span className="portfolio-holding-live-price">
                            {q.price.toLocaleString("en-US", { style: "currency", currency: q.currency ?? "USD" })}
                          </span>
                        ) : (
                          <span className="portfolio-stock-live-hint__muted">—</span>
                        )
                      ) : (
                        <span className="portfolio-stock-live-hint__muted">—</span>
                      )}
                    </td>
                    <td className="portfolio-manage-table__detail">{r.detail}</td>
                    <td className="portfolio-manage-table__num">{formatUsdWhole(r.bookUsd)}</td>
                    <td>
                      <Link className="portfolio-table-link" href={`/portfolio/accounts/${r.accountIdHex}`}>
                        Manage
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
