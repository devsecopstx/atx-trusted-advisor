"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import { DeleteIcon, RefreshIcon, SaveIcon } from "@/app/admin/ui/crud-icons";
import { parseJson } from "@/app/admin/ui/http";
import { parseAccountOutlook, type AccountOutlook } from "@/modules/core-admin/types";
import {
    WATCHLIST_ENTRY_DEFAULT_LINE_TYPE,
    WATCHLIST_ENTRY_DEFAULT_STRATEGY,
    WATCHLIST_UPSERT_DEFAULT_OUTLOOK,
    WATCHLIST_UPSERT_DEFAULT_RISK_PROFILE
} from "@/modules/watchlist/default-upsert-fields";

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

const PRESET_LINE_TYPES = ["Stock", "Option", "ETF", "Futures", "Cash"] as const;
type LineTypeMode = "" | (typeof PRESET_LINE_TYPES)[number] | "custom";

const PRESET_STRATEGIES = [
  "balanced",
  "growth",
  "income",
  "aggressive",
  "wheel",
  "CSP",
  "CC",
  "PMCC",
  "LEAP"
] as const;
type StrategyMode = "" | (typeof PRESET_STRATEGIES)[number] | "custom";

function normalizeDeskRisk(raw: unknown): DeskRiskProfileOption | null {
  if (typeof raw !== "string" || raw.length === 0) {
    return null;
  }
  return (DESK_RISK_PROFILE_OPTIONS as readonly string[]).includes(raw)
    ? (raw as DeskRiskProfileOption)
    : null;
}

function lineTypeToMode(raw: string | undefined): { mode: LineTypeMode; custom: string } {
  const t = (raw ?? "").trim();
  if (!t) {
    return { mode: "", custom: "" };
  }
  if ((PRESET_LINE_TYPES as readonly string[]).includes(t)) {
    return { mode: t as LineTypeMode, custom: "" };
  }
  return { mode: "custom", custom: t };
}

function strategyToMode(raw: string | undefined): { mode: StrategyMode; custom: string } {
  const t = (raw ?? "").trim();
  if (!t) {
    return { mode: "", custom: "" };
  }
  const lower = t.toLowerCase();
  if ((PRESET_STRATEGIES as readonly string[]).includes(lower)) {
    return { mode: lower as StrategyMode, custom: "" };
  }
  return { mode: "custom", custom: t };
}

type SymbolRowEditorProps = {
  row: SymbolRow;
  patchWatchlist: (body: Record<string, unknown>, okMsg: string) => Promise<void>;
  setStatus: (msg: string) => void;
  loading: boolean;
};

function AdminWatchlistSymbolRow({ row, patchWatchlist, setStatus, loading }: SymbolRowEditorProps) {
  const [lineMode, setLineMode] = useState<LineTypeMode>(() => lineTypeToMode(row.lineType).mode);
  const [lineCustom, setLineCustom] = useState(() => lineTypeToMode(row.lineType).custom);

  const [strategyMode, setStrategyMode] = useState<StrategyMode>(() => strategyToMode(row.strategy).mode);
  const [strategyCustom, setStrategyCustom] = useState(() => strategyToMode(row.strategy).custom);

  const [quantity, setQuantity] = useState(() => (row.quantity !== undefined ? String(row.quantity) : ""));
  const [entryPrice, setEntryPrice] = useState(() =>
    row.entryPrice !== undefined ? String(row.entryPrice) : ""
  );

  const resolveLineTypeForSave = (): string | null => {
    if (lineMode === "") {
      return null;
    }
    if (lineMode === "custom") {
      const t = lineCustom.trim();
      return t.length > 0 ? t : null;
    }
    return lineMode;
  };

  const resolveStrategyForSave = (): string | null => {
    if (strategyMode === "") {
      return null;
    }
    if (strategyMode === "custom") {
      const t = strategyCustom.trim();
      return t.length > 0 ? t : null;
    }
    return strategyMode;
  };

  const saveRow = async () => {
    const q = quantity.trim() === "" ? null : Number.parseFloat(quantity);
    const px = entryPrice.trim() === "" ? null : Number.parseFloat(entryPrice);
    if (q !== null && (!Number.isFinite(q) || q < 0)) {
      setStatus("Quantity must be empty or a non-negative number");
      return;
    }
    if (px !== null && (!Number.isFinite(px) || px < 0)) {
      setStatus("Entry price must be empty or a non-negative number");
      return;
    }
    await patchWatchlist(
      {
        addEntries: [
          {
            symbol: row.symbol,
            lineType: resolveLineTypeForSave(),
            strategy: resolveStrategyForSave(),
            quantity: q,
            entryPrice: px
          }
        ]
      },
      `Updated ${row.symbol}`
    );
  };

  let addedLabel = "—";
  try {
    const d = new Date(row.addedAt);
    if (!Number.isNaN(d.getTime())) {
      addedLabel = d.toLocaleString();
    }
  } catch {
    /* keep — */
  }

  return (
    <tr>
      <th scope="row" className="font-mono text-sm align-top">
        {row.symbol}
      </th>
      <td className="align-top" style={{ minWidth: "7.5rem" }}>
        <select
          className="crud-input text-xs"
          disabled={loading}
          value={lineMode}
          onChange={(e) => {
            const v = e.target.value as LineTypeMode;
            setLineMode(v);
            if (v !== "custom") {
              setLineCustom("");
            }
          }}
          aria-label={`${row.symbol} line type`}
        >
          <option value="">—</option>
          {PRESET_LINE_TYPES.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
          <option value="custom">Custom…</option>
        </select>
        {lineMode === "custom" ? (
          <input
            className="crud-input font-mono text-xs"
            style={{ marginTop: "0.35rem" }}
            disabled={loading}
            value={lineCustom}
            onChange={(e) => setLineCustom(e.target.value)}
            placeholder="e.g. Call spread"
            aria-label={`${row.symbol} custom line type`}
          />
        ) : null}
      </td>
      <td className="align-top" style={{ minWidth: "8rem" }}>
        <select
          className="crud-input text-xs"
          disabled={loading}
          value={strategyMode}
          onChange={(e) => {
            const v = e.target.value as StrategyMode;
            setStrategyMode(v);
            if (v !== "custom") {
              setStrategyCustom("");
            }
          }}
          aria-label={`${row.symbol} strategy`}
        >
          <option value="">—</option>
          {PRESET_STRATEGIES.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
          <option value="custom">Custom…</option>
        </select>
        {strategyMode === "custom" ? (
          <input
            className="crud-input text-xs"
            style={{ marginTop: "0.35rem" }}
            disabled={loading}
            value={strategyCustom}
            onChange={(e) => setStrategyCustom(e.target.value)}
            placeholder="Free-text strategy"
            aria-label={`${row.symbol} custom strategy`}
          />
        ) : null}
      </td>
      <td className="align-top" style={{ width: "5rem" }}>
        <input
          className="crud-input font-mono text-xs tabular-nums"
          disabled={loading}
          value={quantity}
          onChange={(e) => setQuantity(e.target.value)}
          placeholder="Qty"
          inputMode="decimal"
          aria-label={`${row.symbol} quantity`}
        />
      </td>
      <td className="align-top" style={{ width: "6rem" }}>
        <input
          className="crud-input font-mono text-xs tabular-nums"
          disabled={loading}
          value={entryPrice}
          onChange={(e) => setEntryPrice(e.target.value)}
          placeholder="Entry"
          inputMode="decimal"
          aria-label={`${row.symbol} entry price`}
        />
      </td>
      <td className="text-xs align-top">{addedLabel}</td>
      <td className="align-top whitespace-nowrap">
        <button
          type="button"
          className="cta cta-secondary text-xs"
          disabled={loading}
          onClick={() => void saveRow()}
        >
          <SaveIcon className="crud-icon" /> Save row
        </button>
      </td>
      <td className="align-top whitespace-nowrap">
        <button
          type="button"
          className="cta cta-secondary text-xs"
          disabled={loading}
          onClick={() => void patchWatchlist({ removeSymbols: [row.symbol] }, `Removed ${row.symbol}`)}
        >
          <DeleteIcon className="crud-icon" />
          Remove
        </button>
      </td>
    </tr>
  );
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
    const isNew = !symbols.some((r) => r.symbol === s);
    const entry = isNew
      ? {
          symbol: s,
          lineType: WATCHLIST_ENTRY_DEFAULT_LINE_TYPE,
          strategy: WATCHLIST_ENTRY_DEFAULT_STRATEGY
        }
      : { symbol: s };
    const body: Record<string, unknown> = { addEntries: [entry] };
    if (normalizeDeskRisk(serverRisk) == null) {
      body.riskProfile = WATCHLIST_UPSERT_DEFAULT_RISK_PROFILE;
    }
    if (parseAccountOutlook(serverOutlook) == null) {
      body.outlook = WATCHLIST_UPSERT_DEFAULT_OUTLOOK;
    }
    await patchWatchlist(body, isNew ? `Upserted ${s} (defaults: Stock / balanced row; desk growth/balanced if unset)` : `${s} unchanged`);
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
          <SaveIcon className="crud-icon" /> Save risk &amp; outlook
        </button>
        <p className="status-text" role="status" aria-live="polite">
          {status}
        </p>
      </PortfolioManageNav>

      <article className="surface-card xf-widget section-card">
        <h3 className="text-sm font-semibold" style={{ marginBottom: "0.35rem" }}>
          Watchlist: {name || "—"}
        </h3>
        <p className="status-text" style={{ marginBottom: "0.75rem" }}>
          <strong>Desk</strong>: choose <strong>Risk profile</strong> and <strong>Outlook</strong> below, then{" "}
          <strong>Save risk &amp; outlook</strong>. <strong>Rows</strong>: each symbol uses the dropdowns/fields in that
          row, then <strong>Save row</strong> or <strong>Remove</strong>. Scroll the table horizontally on narrow
          viewports if needed.
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
            Add / upsert symbol
          </button>
        </div>

        <div className="crud-table-wrap">
          <table className="crud-table admin-portfolio-watchlist-table">
            <thead>
              <tr>
                <th scope="col">Symbol</th>
                <th scope="col">Line type</th>
                <th scope="col">Strategy</th>
                <th scope="col">Qty</th>
                <th scope="col">Entry</th>
                <th scope="col">Added</th>
                <th scope="col">Save</th>
                <th scope="col">Delete</th>
              </tr>
            </thead>
            <tbody>
              {symbols.length === 0 ? (
                <tr>
                  <td colSpan={8} className="status-text">
                    No symbols — add one above.
                  </td>
                </tr>
              ) : (
                symbols.map((row) => (
                  <AdminWatchlistSymbolRow
                    key={[
                      row.symbol,
                      row.lineType ?? "",
                      row.strategy ?? "",
                      row.quantity ?? "",
                      row.entryPrice ?? "",
                      row.addedAt
                    ].join("|")}
                    row={row}
                    patchWatchlist={patchWatchlist}
                    setStatus={setStatus}
                    loading={loading}
                  />
                ))
              )}
            </tbody>
          </table>
        </div>
      </article>
    </section>
  );
}
