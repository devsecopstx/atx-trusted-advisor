"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

import type { SymbolLookupResult } from "@/modules/watchlist/yahoo-symbol-lookup";

import { WatchlistSymbolShape } from "./watchlist-symbol-shape";

type WatchlistRow = {
  symbol: string;
  addedAt: string;
  quote: SymbolLookupResult | null;
};

type WatchlistApiData = {
  name?: string;
  symbols?: Array<{ symbol: string; addedAt: string }>;
  symbolsWithQuotes?: WatchlistRow[];
};

function buildRows(data: WatchlistApiData): WatchlistRow[] {
  if (data.symbolsWithQuotes?.length) {
    return data.symbolsWithQuotes;
  }
  return (data.symbols ?? []).map((s) => ({
    symbol: s.symbol,
    addedAt: s.addedAt,
    quote: null
  }));
}

function toCsv(rows: WatchlistRow[]): string {
  const headers = [
    "Symbol",
    "Company",
    "Price",
    "ChangePct",
    "Volume",
    "Strategy",
    "Entry",
    "Rationale"
  ];
  const lines = rows.map((r) => {
    const q = r.quote;
    const company = (q?.companyName ?? r.symbol).replaceAll('"', '""');
    return [
      r.symbol,
      `"${company}"`,
      q?.price ?? "",
      q?.changePercent ?? "",
      q?.volume ?? "",
      "",
      "",
      ""
    ].join(",");
  });
  return [headers.join(","), ...lines].join("\n");
}

export type WatchlistConsoleProps = {
  portfolioId: string;
  isAdmin: boolean;
};

export function WatchlistConsole({ portfolioId, isAdmin }: WatchlistConsoleProps) {
  const [listName, setListName] = useState("Default");
  const [rows, setRows] = useState<WatchlistRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [mutating, setMutating] = useState(false);
  const [removingSymbol, setRemovingSymbol] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/portfolios/${encodeURIComponent(portfolioId)}/watchlist?quotes=1`,
        { credentials: "include" }
      );
      const json = (await res.json()) as { data?: WatchlistApiData; error?: string };
      if (!res.ok) {
        throw new Error(json.error ?? "Failed to load watchlist");
      }
      if (!json.data) {
        throw new Error("Invalid response");
      }
      setListName(json.data.name ?? "Default");
      setRows(buildRows(json.data));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Load failed");
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [portfolioId]);

  useEffect(() => {
    void load();
  }, [load]);

  const patch = useCallback(
    async (body: Record<string, unknown>) => {
      setMutating(true);
      setError(null);
      try {
        const res = await fetch(
          `/api/portfolios/${encodeURIComponent(portfolioId)}/watchlist?quotes=1`,
          {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            credentials: "include",
            body: JSON.stringify(body)
          }
        );
        const json = (await res.json()) as { data?: WatchlistApiData; error?: string };
        if (!res.ok) {
          throw new Error(json.error ?? "Update failed");
        }
        if (json.data) {
          setListName(json.data.name ?? "Default");
          setRows(buildRows(json.data));
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : "Update failed");
      } finally {
        setMutating(false);
        setRemovingSymbol(null);
      }
    },
    [portfolioId]
  );

  const onRemoveSymbol = useCallback(
    async (symbol: string) => {
      setRemovingSymbol(symbol);
      await patch({ removeSymbols: [symbol] });
    },
    [patch]
  );

  const onDedupe = useCallback(async () => {
    await patch({ dedupe: true });
  }, [patch]);

  const onAdd = useCallback(async () => {
    const raw = window.prompt("Add ticker (e.g. TSLA, AAPL):");
    if (raw == null) {
      return;
    }
    const symbol = raw.trim().toUpperCase();
    if (!symbol || !/^[A-Z0-9.\-]{1,32}$/.test(symbol)) {
      window.alert("Invalid symbol.");
      return;
    }
    await patch({ addSymbols: [symbol] });
  }, [patch]);

  const onExport = useCallback(() => {
    if (rows.length === 0) {
      return;
    }
    const blob = new Blob([toCsv(rows)], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `xfinance-watchlist-${listName.replace(/\s+/g, "-").toLowerCase()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }, [listName, rows]);

  return (
    <div className="xf-watchlist-app">
      <div className="xf-watchlist-layout">
        <aside className="xf-watchlist-sidebar">
          <h2 className="xf-watchlist-sidebar-title">Watchlists</h2>
          <button className="xf-watchlist-new-btn" disabled type="button">
            + New watchlist
          </button>
          <div className="xf-watchlist-nav-item">
            {listName}
            <small>General watchlist for tracking positions and opportunities.</small>
          </div>
        </aside>

        <div className="xf-watchlist-main">
          <div className="xf-watchlist-card xf-noise-overlay">
            <header className="xf-watchlist-card-header">
              <h1 className="xf-watchlist-card-title">{listName}</h1>
              <p className="xf-watchlist-card-sub">
                Quotes load from Yahoo Finance for symbols in your default list. Strategy and entry columns
                wire up when xStrategyBuilder execution lands.
              </p>
            </header>

            <div className="xf-watchlist-toolbar">
              <button className="xf-watchlist-toolbar-btn" disabled type="button">
                Edit
              </button>
              <button className="xf-watchlist-toolbar-btn" disabled type="button">
                Remove in holdings
              </button>
              <button
                className="xf-watchlist-toolbar-btn"
                disabled={rows.length === 0 || loading}
                type="button"
                onClick={onExport}
              >
                Export
              </button>
              <button
                className="xf-watchlist-toolbar-btn xf-watchlist-toolbar-btn--warn"
                disabled={mutating || loading}
                type="button"
                onClick={() => void onDedupe()}
              >
                Remove duplicates
              </button>
              <button className="xf-watchlist-toolbar-btn xf-watchlist-toolbar-btn--danger" disabled type="button">
                Delete
              </button>
              <button
                className="xf-watchlist-toolbar-btn xf-watchlist-toolbar-btn--primary"
                disabled={mutating || loading}
                type="button"
                onClick={() => void onAdd()}
              >
                + Add
              </button>
            </div>

            {error ? (
              <p className="xf-watchlist-status xf-watchlist-status--err" role="alert">
                {error}
              </p>
            ) : null}
            {loading ? (
              <p className="xf-watchlist-status">Loading watchlist…</p>
            ) : null}

            {!loading && rows.length === 0 ? (
              <p className="xf-watchlist-empty">No symbols yet. Use + Add or open xChat to seed defaults.</p>
            ) : null}

            {!loading && rows.length > 0 ? (
              <div className="xf-watchlist-table-wrap">
                <table className="xf-watchlist-table">
                  <thead>
                    <tr>
                      <th scope="col">Instrument</th>
                      <th scope="col">Type — strategy</th>
                      <th scope="col">Entry</th>
                      <th scope="col">Rationale</th>
                      <th scope="col">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((row) => (
                      <tr key={row.symbol}>
                        <td>
                          <WatchlistSymbolShape
                            quote={row.quote}
                            removeBusy={removingSymbol === row.symbol}
                            symbol={row.symbol}
                            onRemoveFromWatchlist={() => void onRemoveSymbol(row.symbol)}
                          />
                        </td>
                        <td className="xf-watchlist-table-mono">—</td>
                        <td className="xf-watchlist-table-mono">—</td>
                        <td className="xf-watchlist-table-mono">—</td>
                        <td>
                          <button
                            aria-label={`Remove ${row.symbol}`}
                            className="xf-watchlist-action-icon"
                            disabled={mutating}
                            type="button"
                            onClick={() => void onRemoveSymbol(row.symbol)}
                          >
                            <svg aria-hidden fill="currentColor" height="18" viewBox="0 0 24 24" width="18">
                              <path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z" />
                            </svg>
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : null}
          </div>

          <div className="cta-row" style={{ flexWrap: "wrap", gap: "0.5rem" }}>
            <Link className="cta cta-secondary" href="/xfinance">
              Back to portfolio
            </Link>
            {isAdmin ? (
              <Link className="cta cta-primary" href="/admin/portfolios">
                Open in admin console
              </Link>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}
