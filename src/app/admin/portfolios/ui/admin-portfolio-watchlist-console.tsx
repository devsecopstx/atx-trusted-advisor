"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import { DeleteIcon, RefreshIcon } from "@/app/admin/ui/crud-icons";
import { parseJson } from "@/app/admin/ui/http";
import { parseAccountOutlook, type AccountOutlook } from "@/modules/core-admin/types";

import {
  accountOutlookValues,
  DESK_OUTLOOK_LABELS,
  DESK_RISK_PROFILE_OPTIONS,
  type DeskRiskProfileOption
} from "./desk-risk-outlook-options";
import { PortfolioManageNav } from "./portfolio-manage-nav";

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
    riskProfile?: DeskRiskProfileOption | null;
    outlook?: AccountOutlook | null;
    symbols: SymbolRow[];
  };
};

function normalizeDeskRisk(raw: unknown): DeskRiskProfileOption | null {
  if (typeof raw !== "string" || raw.length === 0) {
    return null;
  }
  return (DESK_RISK_PROFILE_OPTIONS as readonly string[]).includes(raw)
    ? (raw as DeskRiskProfileOption)
    : null;
}

export function AdminPortfolioWatchlistConsole({ portfolioId }: { portfolioId: string }) {
  const [name, setName] = useState("");
  const [symbols, setSymbols] = useState<SymbolRow[]>([]);
  const [newSymbol, setNewSymbol] = useState("");
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState("Ready — tap refresh");
  const [riskProfile, setRiskProfile] = useState<DeskRiskProfileOption | null>(null);
  const [outlook, setOutlook] = useState<AccountOutlook | null>(null);
  const [serverRisk, setServerRisk] = useState<DeskRiskProfileOption | null>(null);
  const [serverOutlook, setServerOutlook] = useState<AccountOutlook | null>(null);

  const deskDirty = useMemo(() => {
    return (
      normalizeDeskRisk(riskProfile) !== normalizeDeskRisk(serverRisk) ||
      parseAccountOutlook(outlook) !== parseAccountOutlook(serverOutlook)
    );
  }, [riskProfile, outlook, serverRisk, serverOutlook]);

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
      const r = normalizeDeskRisk(payload.data.riskProfile);
      const o = parseAccountOutlook(payload.data.outlook);
      setRiskProfile(r);
      setOutlook(o);
      setServerRisk(r);
      setServerOutlook(o);
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

  const saveDeskContext = async () => {
    const body: Record<string, unknown> = {};
    if (normalizeDeskRisk(riskProfile) !== normalizeDeskRisk(serverRisk)) {
      body.riskProfile = riskProfile;
    }
    if (parseAccountOutlook(outlook) !== parseAccountOutlook(serverOutlook)) {
      body.outlook = outlook;
    }
    if (Object.keys(body).length === 0) {
      return;
    }
    await patchWatchlist(body, "Saved risk & outlook");
  };

  return (
    <section className="panel stack-gap">
      <PortfolioManageNav portfolioId={portfolioId} active="watchlist">
        <button className="cta cta-secondary" disabled={loading} onClick={() => void refresh()} type="button">
          <RefreshIcon className="crud-icon" /> Refresh
        </button>
        <button className="cta cta-secondary" disabled={loading} onClick={() => void dedupe()} type="button">
          Dedupe symbols
        </button>
        <button
          type="button"
          className="cta cta-primary"
          disabled={loading || !deskDirty}
          onClick={() => void saveDeskContext()}
        >
          Save risk &amp; outlook
        </button>
        <p className="status-text">{status}</p>
      </PortfolioManageNav>

      <article className="surface-card xf-widget section-card">
        <h3 className="text-sm font-semibold" style={{ marginBottom: "0.35rem" }}>
          Watchlist: {name || "—"}
        </h3>
        <p className="status-text" style={{ marginBottom: "0.75rem" }}>
          Add or remove symbols for this portfolio&apos;s watchlist (same data as user{" "}
          <code className="font-mono text-xs">/api/portfolios/…/watchlist</code>).
        </p>

        <div
          className="stack-gap"
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: "0.75rem",
            alignItems: "flex-end",
            marginBottom: "1rem"
          }}
        >
          <label className="status-text" style={{ display: "flex", flexDirection: "column", gap: "0.25rem" }}>
            <span className="text-xs font-medium">Risk profile</span>
            <select
              className="crud-input text-xs"
              style={{ minWidth: "10rem" }}
              disabled={loading}
              value={riskProfile ?? ""}
              onChange={(e) => {
                const v = e.target.value;
                setRiskProfile(v === "" ? null : (v as DeskRiskProfileOption));
              }}
            >
              <option value="">—</option>
              {DESK_RISK_PROFILE_OPTIONS.map((v) => (
                <option key={v} value={v}>
                  {v}
                </option>
              ))}
            </select>
          </label>
          <label className="status-text" style={{ display: "flex", flexDirection: "column", gap: "0.25rem" }}>
            <span className="text-xs font-medium">Outlook</span>
            <select
              className="crud-input text-xs"
              style={{ minWidth: "10rem" }}
              disabled={loading}
              value={outlook ?? ""}
              onChange={(e) => {
                const v = e.target.value;
                setOutlook(v === "" ? null : (v as AccountOutlook));
              }}
            >
              <option value="">—</option>
              {accountOutlookValues.map((v) => (
                <option key={v} value={v}>
                  {DESK_OUTLOOK_LABELS[v]}
                </option>
              ))}
            </select>
          </label>
        </div>

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
