"use client";

import { useVirtualizer } from "@tanstack/react-virtual";
import Link from "next/link";
import { useMemo, useRef } from "react";

import type { PortfolioHoldingRow } from "@/lib/portfolio-holding-rows";
import { formatUsdWhole } from "@/lib/portfolio-overview-metrics";
import type { SymbolLookupResult } from "@/modules/watchlist/yahoo-symbol-lookup";

import { PortfolioSymbolMark } from "@/app/portfolio/ui/portfolio-symbol-mark";
import { useSymbolQuotes } from "@/app/portfolio/ui/use-symbol-quotes";

const HOLDINGS_VIRTUAL_MIN_ROWS = 16;
const HOLDINGS_VIRTUAL_ROW_EST_PX = 52;

type PortfolioHoldingsPanelProps = {
  rows: PortfolioHoldingRow[];
  portfolioIdHex: string;
  /** When set, only rows for this account are shown (e.g. selected account on /portfolio). */
  filterAccountIdHex?: string;
};

type HoldingRowViewProps = {
  r: PortfolioHoldingRow;
  quotes: Record<string, SymbolLookupResult | null>;
  loading: boolean;
};

function PortfolioHoldingTableRow({ r, quotes, loading }: HoldingRowViewProps) {
  const sym = r.symbol.trim().toUpperCase();
  const showQuote = r.positionType === "stock" || r.positionType === "option";
  const q: SymbolLookupResult | null | undefined = showQuote ? (quotes[sym] ?? null) : null;
  return (
    <tr>
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
}

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

  const tableScrollRef = useRef<HTMLDivElement>(null);
  const holdingsVirtualize = visibleRows.length >= HOLDINGS_VIRTUAL_MIN_ROWS;
  /* eslint-disable-next-line react-hooks/incompatible-library -- TanStack Virtual */
  const rowVirtualizer = useVirtualizer({
    count: visibleRows.length,
    getScrollElement: () => tableScrollRef.current,
    estimateSize: () => HOLDINGS_VIRTUAL_ROW_EST_PX,
    overscan: 8
  });

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
        <div
          ref={tableScrollRef}
          className="portfolio-table-wrap"
          style={
            holdingsVirtualize
              ? { maxHeight: "min(60vh, 28rem)", overflow: "auto", position: "relative" }
              : undefined
          }
        >
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
            {holdingsVirtualize ? (
              <tbody>
                {(() => {
                  const vItems = rowVirtualizer.getVirtualItems();
                  const padTop = vItems.length > 0 ? vItems[0].start : 0;
                  const padBottom =
                    vItems.length > 0
                      ? rowVirtualizer.getTotalSize() - vItems[vItems.length - 1]!.end
                      : 0;
                  return (
                    <>
                      {padTop > 0 ? (
                        <tr aria-hidden style={{ height: padTop }}>
                          <td colSpan={7} style={{ padding: 0, border: "none" }} />
                        </tr>
                      ) : null}
                      {vItems.map((vr) => {
                        const r = visibleRows[vr.index]!;
                        return (
                          <PortfolioHoldingTableRow
                            key={`${r.accountIdHex}-${r.symbol}-${vr.index}`}
                            loading={loading}
                            quotes={quotes}
                            r={r}
                          />
                        );
                      })}
                      {padBottom > 0 ? (
                        <tr aria-hidden style={{ height: padBottom }}>
                          <td colSpan={7} style={{ padding: 0, border: "none" }} />
                        </tr>
                      ) : null}
                    </>
                  );
                })()}
              </tbody>
            ) : (
              <tbody>
                {visibleRows.map((r, i) => (
                  <PortfolioHoldingTableRow key={`${r.accountIdHex}-${r.symbol}-${i}`} loading={loading} quotes={quotes} r={r} />
                ))}
              </tbody>
            )}
          </table>
        </div>
      )}
    </section>
  );
}
