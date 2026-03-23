"use client";

import Link from "next/link";
import { useCallback, useState } from "react";

type ExpirationsPayload = { underlying: string; expirationDates: string[]; error?: string };
type Leg = {
  premium: number;
  implied_volatility: number;
  last_quote: { bid: number; ask: number };
} | null;

type ChainPayload = {
  underlying: string;
  expiration: string;
  requestedExpiration: string;
  stockPrice: number;
  dataSource: string;
  note?: string;
  optionChain: Array<{
    strike: number;
    call: Leg;
    put: Leg;
  }>;
  error?: string;
};

type StrategyOptionsConsoleProps = {
  /** Defaults to xStrategyBuilder copy + link. */
  eyebrow?: string;
  backHref?: string;
  backLabel?: string;
};

export function StrategyOptionsConsole({
  eyebrow = "xStrategyBuilder · live options",
  backHref = "/xstrategybuilder",
  backLabel = "Back to xStrategyBuilder"
}: StrategyOptionsConsoleProps) {
  const [underlying, setUnderlying] = useState("TSLA");
  const [strike, setStrike] = useState("250");
  const [expirations, setExpirations] = useState<string[]>([]);
  const [expiration, setExpiration] = useState("");
  const [loadingExps, setLoadingExps] = useState(false);
  const [loadingChain, setLoadingChain] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [chain, setChain] = useState<ChainPayload | null>(null);

  const loadExpirations = useCallback(async () => {
    setLoadingExps(true);
    setError(null);
    try {
      const u = underlying.trim().toUpperCase();
      const res = await fetch(
        `/api/strategy-options/expirations?underlying=${encodeURIComponent(u)}`,
        { credentials: "include" }
      );
      const json = (await res.json()) as ExpirationsPayload;
      if (!res.ok) {
        throw new Error(json.error ?? "Failed to load expirations");
      }
      const dates = json.expirationDates ?? [];
      setExpirations(dates);
      setExpiration((prev) => {
        if (prev && dates.includes(prev)) {
          return prev;
        }
        return dates[0] ?? "";
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Expirations failed");
      setExpirations([]);
    } finally {
      setLoadingExps(false);
    }
  }, [underlying]);

  const loadChain = useCallback(async () => {
    setLoadingChain(true);
    setError(null);
    setChain(null);
    try {
      const u = underlying.trim().toUpperCase();
      const exp = expiration.trim();
      const k = strike.trim() || "0";
      const qs = new URLSearchParams({
        underlying: u,
        expiration: exp,
        strike: k
      });
      const res = await fetch(`/api/strategy-options?${qs.toString()}`, { credentials: "include" });
      const json = (await res.json()) as ChainPayload & { error?: string };
      if (!res.ok) {
        throw new Error(json.error ?? "Failed to load chain");
      }
      setChain(json);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Chain failed");
    } finally {
      setLoadingChain(false);
    }
  }, [underlying, expiration, strike]);

  return (
    <div className="xchat-body" style={{ padding: "1rem", maxWidth: "960px" }}>
      <p className="eyebrow">{eyebrow}</p>
      <h1 className="hero-title" style={{ fontSize: "1.5rem", marginBottom: "0.5rem" }}>
        Strategy options chain
      </h1>
      <p className="hero-copy" style={{ marginBottom: "1rem" }}>
        Same Yahoo + synthetic fallback contract as xfinance-strategy{" "}
        <code className="xsb-inline-code">GET /api/options</code>. Session required.
      </p>

      <div className="xf-noise-overlay" style={{ padding: "1rem", borderRadius: "12px", marginBottom: "1rem" }}>
        <div style={{ display: "flex", flexWrap: "wrap", gap: "0.75rem", alignItems: "flex-end" }}>
          <label style={{ display: "flex", flexDirection: "column", gap: "0.25rem" }}>
            <span>Underlying</span>
            <input
              className="xsb-builder-nl-input"
              style={{ minWidth: "120px" }}
              value={underlying}
              onChange={(e) => setUnderlying(e.target.value.toUpperCase())}
            />
          </label>
          <label style={{ display: "flex", flexDirection: "column", gap: "0.25rem" }}>
            <span>Strike (synthetic anchor)</span>
            <input
              className="xsb-builder-nl-input"
              style={{ minWidth: "100px" }}
              value={strike}
              onChange={(e) => setStrike(e.target.value)}
            />
          </label>
          <button
            className="cta cta-secondary"
            disabled={loadingExps}
            type="button"
            onClick={() => void loadExpirations()}
          >
            {loadingExps ? "Loading…" : "Load expirations"}
          </button>
        </div>

        {expirations.length > 0 ? (
          <label style={{ display: "flex", flexDirection: "column", gap: "0.25rem", marginTop: "1rem" }}>
            <span>Expiration</span>
            <select
              className="xsb-builder-nl-input"
              value={expiration}
              onChange={(e) => setExpiration(e.target.value)}
            >
              {expirations.map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </select>
          </label>
        ) : null}

        <button
          className="cta cta-primary"
          disabled={loadingChain || !expiration}
          style={{ marginTop: "1rem" }}
          type="button"
          onClick={() => void loadChain()}
        >
          {loadingChain ? "Loading chain…" : "Load option chain"}
        </button>
      </div>

      {error ? (
        <p className="xf-watchlist-status xf-watchlist-status--err" role="alert">
          {error}
        </p>
      ) : null}

      {chain ? (
        <div className="xf-noise-overlay" style={{ padding: "1rem", borderRadius: "12px", overflow: "auto" }}>
          <p style={{ marginBottom: "0.5rem" }}>
            <strong>{chain.underlying}</strong> · exp {chain.expiration} (requested {chain.requestedExpiration}) ·
            spot ~{chain.stockPrice.toFixed(2)} · <em>{chain.dataSource}</em>
          </p>
          {chain.note ? <p style={{ fontSize: "0.9rem", opacity: 0.85 }}>{chain.note}</p> : null}
          <table className="xf-watchlist-table" style={{ marginTop: "0.75rem" }}>
            <thead>
              <tr>
                <th>Strike</th>
                <th>Call bid/ask</th>
                <th>Call IV %</th>
                <th>Put bid/ask</th>
                <th>Put IV %</th>
              </tr>
            </thead>
            <tbody>
              {chain.optionChain.slice(0, 40).map((row) => (
                <tr key={row.strike}>
                  <td className="xf-watchlist-table-mono">{row.strike}</td>
                  <td className="xf-watchlist-table-mono">
                    {row.call
                      ? `${row.call.last_quote.bid} / ${row.call.last_quote.ask}`
                      : "—"}
                  </td>
                  <td className="xf-watchlist-table-mono">
                    {row.call ? row.call.implied_volatility : "—"}
                  </td>
                  <td className="xf-watchlist-table-mono">
                    {row.put ? `${row.put.last_quote.bid} / ${row.put.last_quote.ask}` : "—"}
                  </td>
                  <td className="xf-watchlist-table-mono">
                    {row.put ? row.put.implied_volatility : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {chain.optionChain.length > 40 ? (
            <p style={{ marginTop: "0.5rem", fontSize: "0.85rem" }}>Showing first 40 strikes.</p>
          ) : null}
        </div>
      ) : null}

      <div className="cta-row" style={{ marginTop: "1.25rem" }}>
        <Link className="cta cta-secondary" href={backHref}>
          {backLabel}
        </Link>
      </div>
    </div>
  );
}
