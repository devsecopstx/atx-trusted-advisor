"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

import { DeleteIcon, RefreshIcon } from "@/app/admin/ui/crud-icons";
import { parseJson } from "@/app/admin/ui/http";

type SymbolRow = {
  symbol: string;
  addedAt: string;
  lineType?: string;
  strategy?: string;
  quantity?: number;
  entryPrice?: number;
};

type WatchlistPayload = {
  data: {
    name: string;
    symbols: SymbolRow[];
  };
};

export function AdminPortfolioWatchlistConsole({ portfolioId }: { portfolioId: string }) {
  const [name, setName] = useState("");
  const [symbols, setSymbols] = useState<SymbolRow[]>([]);
  const [newSymbol, setNewSymbol] = useState("");
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState("Ready — tap refresh");

  const refresh = useCallback(async () => {
    setLoading(true);
    setStatus("Loading…");
    try {
      const payload = await parseJson<WatchlistPayload>(
        await fetch(`/api/admin/portfolios/${encodeURIComponent(portfolioId)}/watchlist`, {
          cache: "no-store"
        })
      );
      setName(payload.data.name);
      setSymbols(payload.data.symbols ?? []);
      setStatus(`Loaded ${payload.data.symbols?.length ?? 0} symbol(s)`);
    } catch (e) {
      setStatus(e instanceof Error ? e.message : "Failed to load");
      setSymbols([]);
    } finally {
      setLoading(false);
    }
  }, [portfolioId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const patchWatchlist = async (body: Record<string, unknown>, okMsg: string) => {
    setLoading(true);
    setStatus("Saving…");
    try {
      await parseJson(
        await fetch(`/api/admin/portfolios/${encodeURIComponent(portfolioId)}/watchlist`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body)
        })
      );
      setStatus(okMsg);
      void refresh();
    } catch (e) {
      setStatus(e instanceof Error ? e.message : "Save failed");
    } finally {
      setLoading(false);
    }
  };

  const addSymbol = async () => {
    const s = newSymbol.trim().toUpperCase();
    if (!s) {
      setStatus("Enter a symbol");
      return;
    }
    setNewSymbol("");
    await patchWatchlist({ addSymbols: [s] }, `Added ${s}`);
  };

  const removeSymbol = async (symbol: string) => {
    await patchWatchlist({ removeSymbols: [symbol] }, `Removed ${symbol}`);
  };

  const dedupe = async () => {
    await patchWatchlist({ dedupe: true }, "Deduped symbols");
  };

  return (
    <section className="panel stack-gap">
      <div className="tool-row" style={{ flexWrap: "wrap", gap: "0.75rem" }}>
        <Link className="cta cta-secondary" href="/admin/portfolios">
          ← Portfolios
        </Link>
        <Link className="cta cta-secondary" href={`/admin/portfolios/${encodeURIComponent(portfolioId)}/accounts`}>
          Manage accounts
        </Link>
        <button className="cta cta-secondary" disabled={loading} onClick={() => void refresh()} type="button">
          <RefreshIcon className="crud-icon" /> Refresh
        </button>
        <button className="cta cta-secondary" disabled={loading} onClick={() => void dedupe()} type="button">
          Dedupe symbols
        </button>
        <p className="status-text">{status}</p>
      </div>

      <article className="surface-card xf-widget section-card">
        <h3 className="text-sm font-semibold" style={{ marginBottom: "0.35rem" }}>
          Watchlist: {name || "—"}
        </h3>
        <p className="status-text" style={{ marginBottom: "0.75rem" }}>
          Add or remove symbols for this portfolio&apos;s watchlist (same data as user{" "}
          <code className="font-mono text-xs">/api/portfolios/…/watchlist</code>).
        </p>

        <div className="stack-gap" style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem", marginBottom: "1rem" }}>
          <input
            className="crud-input"
            placeholder="Symbol (e.g. TSLA)"
            value={newSymbol}
            onChange={(e) => setNewSymbol(e.target.value)}
            style={{ maxWidth: "12rem" }}
          />
          <button type="button" className="cta cta-primary" disabled={loading} onClick={() => void addSymbol()}>
            Add symbol
          </button>
        </div>

        <div className="crud-table-wrap">
          <table className="crud-table">
            <thead>
              <tr>
                <th>Symbol</th>
                <th>Type</th>
                <th>Strategy</th>
                <th>Qty</th>
                <th>Entry</th>
                <th>Added</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {symbols.length === 0 ? (
                <tr>
                  <td colSpan={7} className="status-text">
                    No symbols — add one above.
                  </td>
                </tr>
              ) : (
                symbols.map((row) => (
                  <tr key={row.symbol}>
                    <td className="font-mono text-sm">{row.symbol}</td>
                    <td className="text-xs">{row.lineType ?? "—"}</td>
                    <td className="text-xs">{row.strategy ?? "—"}</td>
                    <td className="text-xs">{row.quantity ?? "—"}</td>
                    <td className="text-xs">{row.entryPrice ?? "—"}</td>
                    <td className="text-xs">{new Date(row.addedAt).toLocaleString()}</td>
                    <td>
                      <button
                        type="button"
                        className="tiny-button"
                        disabled={loading}
                        title="Remove symbol"
                        onClick={() => void removeSymbol(row.symbol)}
                      >
                        <DeleteIcon className="crud-icon" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </article>
    </section>
  );
}
