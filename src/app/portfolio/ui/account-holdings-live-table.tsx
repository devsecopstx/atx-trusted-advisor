"use client";

import { useMemo } from "react";

import { DeleteIcon } from "@/app/admin/ui/crud-icons";
import type { SerializablePosition } from "@/app/portfolio/accounts/serializable-account";

import { PortfolioSymbolMark } from "@/app/portfolio/ui/portfolio-symbol-mark";
import { useSymbolQuotes } from "@/app/portfolio/ui/use-symbol-quotes";

function positionSummary(p: SerializablePosition): string {
  if (p.type === "stock") {
    return `${p.symbol} · ${p.shares} sh @ ${p.purchasePrice.toLocaleString("en-US", { style: "currency", currency: "USD" })}`;
  }
  if (p.type === "cash") {
    return `${p.label}: ${p.amountFormatted}`;
  }
  return `${p.symbol} ${p.optionType.toUpperCase()} ${p.strike} ${p.expiration} · ${p.yahooRef || "—"} · ${p.contracts}× @ ${p.premiumPerContract.toFixed(2)}/ct`;
}

function underlyingSymbol(p: SerializablePosition): string | null {
  if (p.type === "stock" || p.type === "option") {
    return p.symbol.trim().toUpperCase();
  }
  return null;
}

type AccountHoldingsLiveTableProps = {
  positions: SerializablePosition[];
  pending: boolean;
  onRemove: (positionId: string) => void;
  /** When set, live quotes are withheld while a broker import is running for this book. */
  portfolioIdHex?: string;
};

export function AccountHoldingsLiveTable({
  positions,
  pending,
  onRemove,
  portfolioIdHex
}: AccountHoldingsLiveTableProps) {
  const quoteSymbols = useMemo(() => {
    const s = new Set<string>();
    for (const p of positions) {
      const u = underlyingSymbol(p);
      if (u) {
        s.add(u);
      }
    }
    return [...s];
  }, [positions]);

  const { quotes, loading } = useSymbolQuotes(quoteSymbols, { portfolioIdHex });

  return (
    <div className="crud-table-wrap">
      <table className="crud-table">
        <thead>
          <tr>
            <th scope="col">Type</th>
            <th scope="col">Symbol</th>
            <th scope="col">Live</th>
            <th scope="col">Details</th>
            <th scope="col" />
          </tr>
        </thead>
        <tbody>
          {positions.map((p) => {
            const u = underlyingSymbol(p);
            const q = u ? quotes[u] : null;
            const showLive = p.type === "stock" || p.type === "option";
            return (
              <tr key={p._id}>
                <td className="text-xs" style={{ textTransform: "capitalize" }}>
                  {p.type}
                </td>
                <td>
                  {showLive && u ? (
                    <div className="portfolio-holding-live-sym">
                      <PortfolioSymbolMark
                        logoUrl={q?.logoUrl}
                        symbol={u}
                        title={q?.companyName ?? u}
                        size={30}
                      />
                      <span className="portfolio-holding-live-sym__ticker">{u}</span>
                    </div>
                  ) : (
                    <span className="text-sm" style={{ fontFamily: "ui-monospace, monospace" }}>
                      {p.type === "cash" ? p.label : p.symbol}
                    </span>
                  )}
                </td>
                <td className="text-xs" style={{ minWidth: "6.5rem" }}>
                  {showLive ? (
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
                <td className="text-sm" style={{ fontFamily: "ui-monospace, monospace", color: "var(--xf-text-300)" }}>
                  {positionSummary(p)}
                </td>
                <td>
                  <button
                    type="button"
                    className="cta cta-secondary"
                    style={{ fontSize: "0.8rem", padding: "0.35rem 0.65rem" }}
                    disabled={pending}
                    onClick={() => onRemove(p._id)}
                  >
                    <DeleteIcon className="crud-icon" />
                    Remove
                  </button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
