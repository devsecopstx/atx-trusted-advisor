"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState, type ChangeEvent } from "react";

import {
    MAX_WATCHLIST_SYMBOLS,
    MAX_WATCHLIST_SYMBOLS_PER_PATCH
} from "@/modules/watchlist/constants";
import {
    parseWatchlistCsv,
    type WatchlistCsvEntry
} from "@/modules/watchlist/parse-watchlist-csv";
import type { SymbolLookupResult } from "@/modules/watchlist/yahoo-symbol-lookup";

import { WatchlistSymbolShape } from "./watchlist-symbol-shape";

type WatchlistRow = {
  symbol: string;
  addedAt: string;
  quote: SymbolLookupResult | null;
  lineType?: string;
  strategy?: string;
  quantity?: number;
  entryPrice?: number;
};

type WatchlistApiData = {
  name?: string;
  symbols?: Array<{
    symbol: string;
    addedAt: string;
    lineType?: string;
    strategy?: string;
    quantity?: number;
    entryPrice?: number;
  }>;
  symbolsWithQuotes?: WatchlistRow[];
};

function buildRows(data: WatchlistApiData): WatchlistRow[] {
  if (data.symbolsWithQuotes?.length) {
    return data.symbolsWithQuotes;
  }
  return (data.symbols ?? []).map((s) => ({
    symbol: s.symbol,
    addedAt: s.addedAt,
    quote: null,
    lineType: s.lineType,
    strategy: s.strategy,
    quantity: s.quantity,
    entryPrice: s.entryPrice
  }));
}

function chunkSymbols<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    out.push(items.slice(i, i + size));
  }
  return out;
}

type WatchlistPatchEntry = {
  symbol: string;
  lineType?: string;
  strategy?: string;
  quantity?: number | null;
  entryPrice?: number | null;
};

function normWatchlistField(s?: string): string {
  return (s ?? "").trim();
}

function cloneWatchlistRow(r: WatchlistRow): WatchlistRow {
  return { ...r };
}

/** Rows that exist in both lists; emits PATCH addEntries rows only where metadata changed. */
function buildDirtyAddEntries(baseline: WatchlistRow[], draft: WatchlistRow[]): WatchlistPatchEntry[] {
  const bySym = new Map(baseline.map((row) => [row.symbol, row]));
  const out: WatchlistPatchEntry[] = [];
  for (const d of draft) {
    const b = bySym.get(d.symbol);
    if (!b) {
      continue;
    }
    if (
      normWatchlistField(b.lineType) === normWatchlistField(d.lineType) &&
      normWatchlistField(b.strategy) === normWatchlistField(d.strategy) &&
      b.quantity === d.quantity &&
      b.entryPrice === d.entryPrice
    ) {
      continue;
    }
    const entry: WatchlistPatchEntry = { symbol: d.symbol };
    if (normWatchlistField(b.lineType) !== normWatchlistField(d.lineType)) {
      entry.lineType = d.lineType?.trim() ?? "";
    }
    if (normWatchlistField(b.strategy) !== normWatchlistField(d.strategy)) {
      entry.strategy = d.strategy?.trim() ?? "";
    }
    if (b.quantity !== d.quantity) {
      entry.quantity =
        d.quantity !== undefined && Number.isFinite(d.quantity) ? d.quantity : null;
    }
    if (b.entryPrice !== d.entryPrice) {
      entry.entryPrice =
        d.entryPrice !== undefined && Number.isFinite(d.entryPrice) ? d.entryPrice : null;
    }
    out.push(entry);
  }
  return out;
}

function formatTypeStrategyCell(row: WatchlistRow): string {
  const a = row.lineType?.trim();
  const b = row.strategy?.trim();
  if (a && b) {
    return `${a} — ${b}`;
  }
  if (a) {
    return a;
  }
  if (b) {
    return b;
  }
  return "—";
}

function formatEntryCell(row: WatchlistRow): string {
  if (row.quantity === undefined && row.entryPrice === undefined) {
    return "—";
  }
  const q = row.quantity != null ? String(row.quantity) : "";
  const p =
    row.entryPrice != null
      ? row.entryPrice.toLocaleString(undefined, { maximumFractionDigits: 6 })
      : "";
  if (q && p) {
    return `${q} @ ${p}`;
  }
  return p || q || "—";
}

function toCsv(rows: WatchlistRow[]): string {
  const headers = [
    "Symbol",
    "Company",
    "Price",
    "ChangePct",
    "Volume",
    "Type",
    "Strategy",
    "Quantity",
    "Entry Price",
    "Rationale"
  ];
  const lines = rows.map((r) => {
    const q = r.quote;
    const company = (q?.companyName ?? r.symbol).replaceAll('"', '""');
    const typeEsc = (r.lineType ?? "").replaceAll('"', '""');
    const stratEsc = (r.strategy ?? "").replaceAll('"', '""');
    return [
      r.symbol,
      `"${company}"`,
      q?.price ?? "",
      q?.changePercent ?? "",
      q?.volume ?? "",
      typeEsc ? `"${typeEsc}"` : "",
      stratEsc ? `"${stratEsc}"` : "",
      r.quantity ?? "",
      r.entryPrice ?? "",
      ""
    ].join(",");
  });
  return [headers.join(","), ...lines].join("\n");
}

function buildImportWorkload(
  entries: WatchlistCsvEntry[],
  currentSymbols: string[]
): { workload: WatchlistCsvEntry[]; skippedNewCount: number } {
  const seen = new Set(currentSymbols);
  let addBudget = Math.max(0, MAX_WATCHLIST_SYMBOLS - currentSymbols.length);
  const workload: WatchlistCsvEntry[] = [];
  let skippedNewCount = 0;

  for (const e of entries) {
    if (seen.has(e.symbol)) {
      workload.push(e);
      continue;
    }
    if (addBudget > 0) {
      workload.push(e);
      seen.add(e.symbol);
      addBudget -= 1;
    } else {
      skippedNewCount += 1;
    }
  }

  return { workload, skippedNewCount };
}

export type WatchlistConsoleProps = {
  portfolioId: string;
  isAdmin: boolean;
  /** API base including `/api/.../portfolios` (no trailing slash). Default `/api/portfolios`. */
  watchlistApiPrefix?: string;
  /** `admin` — footer links to admin hubs; `app_user` — portfolio + optional admin console link. */
  footerMode?: "app_user" | "admin";
};

export function WatchlistConsole({
  portfolioId,
  isAdmin,
  watchlistApiPrefix = "/api/portfolios",
  footerMode = "app_user"
}: WatchlistConsoleProps) {
  const watchlistBaseUrl = `${watchlistApiPrefix}/${encodeURIComponent(portfolioId)}/watchlist`;
  const [listName, setListName] = useState("Default");
  const [rows, setRows] = useState<WatchlistRow[]>([]);
  const [editMode, setEditMode] = useState(false);
  const [draftName, setDraftName] = useState("");
  const [draftRows, setDraftRows] = useState<WatchlistRow[]>([]);
  const editBaselineRef = useRef<{ name: string; rows: WatchlistRow[] } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [mutating, setMutating] = useState(false);
  const [removingSymbol, setRemovingSymbol] = useState<string | null>(null);
  const importFileRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${watchlistBaseUrl}?quotes=1`, { credentials: "include" });
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
  }, [watchlistBaseUrl]);

  useEffect(() => {
    void load();
  }, [load]);

  const executePatch = useCallback(async (body: Record<string, unknown>) => {
    const res = await fetch(`${watchlistBaseUrl}?quotes=1`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify(body)
    });
    const json = (await res.json()) as { data?: WatchlistApiData; error?: string };
    if (!res.ok) {
      throw new Error(json.error ?? "Update failed");
    }
    if (json.data) {
      setListName(json.data.name ?? "Default");
      setRows(buildRows(json.data));
    }
  }, [watchlistBaseUrl]);

  const patch = useCallback(
    async (body: Record<string, unknown>) => {
      setMutating(true);
      setError(null);
      try {
        await executePatch(body);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Update failed");
      } finally {
        setMutating(false);
        setRemovingSymbol(null);
      }
    },
    [executePatch]
  );

  const enterEdit = useCallback(() => {
    editBaselineRef.current = {
      name: listName,
      rows: rows.map(cloneWatchlistRow)
    };
    setDraftName(listName);
    setDraftRows(rows.map(cloneWatchlistRow));
    setEditMode(true);
  }, [listName, rows]);

  const cancelEdit = useCallback(() => {
    setEditMode(false);
    editBaselineRef.current = null;
  }, []);

  const saveEdits = useCallback(async () => {
    const baseline = editBaselineRef.current;
    if (!baseline) {
      return;
    }
    const trimmed = draftName.trim();
    if (trimmed.length === 0) {
      window.alert("Watchlist name cannot be empty.");
      return;
    }
    setMutating(true);
    setError(null);
    try {
      const nameChanged = trimmed !== baseline.name.trim();
      const removed = baseline.rows
        .filter((b) => !draftRows.some((d) => d.symbol === b.symbol))
        .map((b) => b.symbol);
      const addEntries = buildDirtyAddEntries(baseline.rows, draftRows);
      if (!nameChanged && removed.length === 0 && addEntries.length === 0) {
        setEditMode(false);
        editBaselineRef.current = null;
        return;
      }
      let nameSent = false;
      const takeNamePayload = (): Record<string, unknown> => {
        if (!nameChanged || nameSent) {
          return {};
        }
        nameSent = true;
        return { name: trimmed };
      };
      for (const batch of chunkSymbols(removed, MAX_WATCHLIST_SYMBOLS_PER_PATCH)) {
        await executePatch({ removeSymbols: batch, ...takeNamePayload() });
      }
      for (const batch of chunkSymbols(addEntries, MAX_WATCHLIST_SYMBOLS_PER_PATCH)) {
        await executePatch({ addEntries: batch, ...takeNamePayload() });
      }
      if (nameChanged && !nameSent) {
        await executePatch({ name: trimmed });
      }
      setEditMode(false);
      editBaselineRef.current = null;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Update failed");
    } finally {
      setMutating(false);
      setRemovingSymbol(null);
    }
  }, [draftName, draftRows, executePatch]);

  const updateDraftRow = useCallback(
    (
      symbol: string,
      partial: Partial<Pick<WatchlistRow, "lineType" | "strategy" | "quantity" | "entryPrice">>
    ) => {
      setDraftRows((prev) =>
        prev.map((r) => (r.symbol === symbol ? { ...r, ...partial } : r))
      );
    },
    []
  );

  const onRemoveSymbol = useCallback(
    async (symbol: string) => {
      if (editMode) {
        setDraftRows((prev) => prev.filter((r) => r.symbol !== symbol));
        return;
      }
      setRemovingSymbol(symbol);
      await patch({ removeSymbols: [symbol] });
    },
    [editMode, patch]
  );

  const onDedupe = useCallback(async () => {
    if (editMode) {
      return;
    }
    await patch({ dedupe: true });
  }, [editMode, patch]);

  const onAdd = useCallback(async () => {
    if (editMode) {
      return;
    }
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
  }, [editMode, patch]);

  const onExport = useCallback(() => {
    if (rows.length === 0) {
      return;
    }
    const blob = new Blob([toCsv(rows)], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `atxfinance-watchlist-${listName.replace(/\s+/g, "-").toLowerCase()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }, [listName, rows]);

  const onPickImportFile = useCallback(() => {
    importFileRef.current?.click();
  }, []);

  const onImportFileChange = useCallback(
    async (event: ChangeEvent<HTMLInputElement>) => {
      if (editMode) {
        event.target.value = "";
        return;
      }
      const file = event.target.files?.[0];
      event.target.value = "";
      if (!file) {
        return;
      }
      let text: string;
      try {
        text = await file.text();
      } catch {
        window.alert("Could not read that file.");
        return;
      }
      const { entries, invalidRowCount } = parseWatchlistCsv(text);
      if (entries.length === 0) {
        window.alert("No valid tickers found. Use a column named Symbol (or put tickers in the first column).");
        return;
      }
      const currentSymbols = rows.map((r) => r.symbol);
      const { workload, skippedNewCount } = buildImportWorkload(entries, currentSymbols);
      if (workload.length === 0) {
        if (skippedNewCount > 0) {
          window.alert(
            `Watchlist is full (${MAX_WATCHLIST_SYMBOLS} symbols max). Remove some before adding new tickers from this file.`
          );
        } else {
          window.alert("Nothing to apply from this file.");
        }
        return;
      }
      setMutating(true);
      setError(null);
      try {
        for (const batch of chunkSymbols(workload, MAX_WATCHLIST_SYMBOLS_PER_PATCH)) {
          const res = await fetch(`${watchlistBaseUrl}?quotes=1`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            credentials: "include",
            body: JSON.stringify({ addEntries: batch })
          });
          const json = (await res.json()) as { data?: WatchlistApiData; error?: string };
          if (!res.ok) {
            throw new Error(json.error ?? "Update failed");
          }
          if (json.data) {
            setListName(json.data.name ?? "Default");
            setRows(buildRows(json.data));
          }
        }
        const parts = [
          `Applied ${workload.length} row${workload.length === 1 ? "" : "s"} (Type, Strategy, Quantity; Entry Price/Entry when set, else Price, Last, or Close → stored entry price).`
        ];
        if (invalidRowCount > 0) {
          parts.push(`Skipped ${invalidRowCount} invalid row${invalidRowCount === 1 ? "" : "s"}.`);
        }
        if (skippedNewCount > 0) {
          parts.push(
            `${skippedNewCount} new ticker${skippedNewCount === 1 ? "" : "s"} not added (watchlist holds at most ${MAX_WATCHLIST_SYMBOLS} symbols).`
          );
        }
        window.alert(parts.join(" "));
      } catch (e) {
        setError(e instanceof Error ? e.message : "Import failed");
      } finally {
        setMutating(false);
      }
    },
    [editMode, rows, watchlistBaseUrl]
  );

  const displayRows = editMode ? draftRows : rows;
  const sidebarTitle = editMode ? draftName || listName : listName;

  return (
    <div className="xf-watchlist-app">
      <div className="xf-watchlist-layout">
        <aside className="xf-watchlist-sidebar">
          <h2 className="xf-watchlist-sidebar-title">Watchlists</h2>
          <button className="xf-watchlist-new-btn" disabled type="button">
            + New watchlist
          </button>
          <div className="xf-watchlist-nav-item">
            {sidebarTitle}
            <small>General watchlist for tracking positions and opportunities.</small>
          </div>
        </aside>

        <div className="xf-watchlist-main">
          <div className="xf-watchlist-card xf-noise-overlay">
            <header className="xf-watchlist-card-header">
              {editMode ? (
                <input
                  aria-label="Watchlist name"
                  className="xf-watchlist-name-input"
                  maxLength={128}
                  type="text"
                  value={draftName}
                  onChange={(e) => setDraftName(e.target.value)}
                />
              ) : (
                <h1 className="xf-watchlist-card-title">{listName}</h1>
              )}
              <p className="xf-watchlist-card-sub">
                Quotes load from Yahoo Finance. Type, Strategy, Quantity, and Entry Price are stored with each
                symbol (CSV import/export). Use Edit to change fields, then Save changes.
              </p>
            </header>

            <input
              ref={importFileRef}
              accept=".csv,text/csv"
              aria-hidden
              className="xf-watchlist-import-input"
              style={{ display: "none" }}
              tabIndex={-1}
              type="file"
              onChange={(e) => void onImportFileChange(e)}
            />
            <div className="xf-watchlist-toolbar">
              {!editMode ? (
                <button
                  className="xf-watchlist-toolbar-btn"
                  disabled={loading}
                  type="button"
                  onClick={enterEdit}
                >
                  Edit
                </button>
              ) : (
                <>
                  <button
                    className="xf-watchlist-toolbar-btn xf-watchlist-toolbar-btn--primary"
                    disabled={mutating}
                    type="button"
                    onClick={() => void saveEdits()}
                  >
                    Save changes
                  </button>
                  <button
                    className="xf-watchlist-toolbar-btn"
                    disabled={mutating}
                    type="button"
                    onClick={cancelEdit}
                  >
                    Cancel
                  </button>
                </>
              )}
              <button className="xf-watchlist-toolbar-btn" disabled type="button">
                Remove in holdings
              </button>
              <button
                className="xf-watchlist-toolbar-btn"
                disabled={rows.length === 0 || loading || editMode}
                type="button"
                onClick={onExport}
              >
                Export CSV
              </button>
              <button
                aria-label="Import watchlist from a CSV file"
                className="xf-watchlist-toolbar-btn"
                disabled={mutating || loading || editMode}
                type="button"
                onClick={onPickImportFile}
              >
                Import CSV
              </button>
              <button
                className="xf-watchlist-toolbar-btn xf-watchlist-toolbar-btn--warn"
                disabled={mutating || loading || editMode}
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
                disabled={mutating || loading || editMode}
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

            {!loading && displayRows.length === 0 ? (
              <p className="xf-watchlist-empty">
                No symbols yet. Use + Add, Import CSV (e.g. <code>atxfinance-watchlist.csv</code>), or open xChat to
                seed defaults.
              </p>
            ) : null}

            {!loading && displayRows.length > 0 ? (
              <div className="xf-watchlist-table-wrap">
                <table className="xf-watchlist-table">
                  <thead>
                    <tr>
                      <th scope="col">Instrument</th>
                      <th scope="col">Type — strategy</th>
                      <th scope="col">Entry</th>
                      {/* TODO(options-scanner): Rationale column — populate from options-scanner (planned); UI placeholder until then. */}
                      <th scope="col">Rationale</th>
                      <th scope="col">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {displayRows.map((row) => (
                      <tr key={row.symbol}>
                        <td>
                          <WatchlistSymbolShape
                            quote={row.quote}
                            removeBusy={removingSymbol === row.symbol}
                            symbol={row.symbol}
                            onRemoveFromWatchlist={() => void onRemoveSymbol(row.symbol)}
                          />
                        </td>
                        <td className="xf-watchlist-table-mono">
                          {editMode ? (
                            <div className="xf-watchlist-edit-stack">
                              <input
                                aria-label={`${row.symbol} type`}
                                className="xf-watchlist-table-input"
                                placeholder="Type"
                                type="text"
                                value={row.lineType ?? ""}
                                onChange={(e) =>
                                  updateDraftRow(row.symbol, { lineType: e.target.value })
                                }
                              />
                              <input
                                aria-label={`${row.symbol} strategy`}
                                className="xf-watchlist-table-input"
                                placeholder="Strategy"
                                type="text"
                                value={row.strategy ?? ""}
                                onChange={(e) =>
                                  updateDraftRow(row.symbol, { strategy: e.target.value })
                                }
                              />
                            </div>
                          ) : (
                            formatTypeStrategyCell(row)
                          )}
                        </td>
                        <td className="xf-watchlist-table-mono">
                          {editMode ? (
                            <div className="xf-watchlist-edit-stack">
                              <input
                                aria-label={`${row.symbol} quantity`}
                                className="xf-watchlist-table-input"
                                inputMode="decimal"
                                placeholder="Quantity"
                                type="text"
                                value={row.quantity === undefined ? "" : String(row.quantity)}
                                onChange={(e) => {
                                  const v = e.target.value.trim();
                                  if (v === "") {
                                    updateDraftRow(row.symbol, { quantity: undefined });
                                    return;
                                  }
                                  const n = Number(v);
                                  updateDraftRow(row.symbol, {
                                    quantity: Number.isFinite(n) ? n : undefined
                                  });
                                }}
                              />
                              <input
                                aria-label={`${row.symbol} entry price`}
                                className="xf-watchlist-table-input"
                                inputMode="decimal"
                                placeholder="Entry price"
                                type="text"
                                value={row.entryPrice === undefined ? "" : String(row.entryPrice)}
                                onChange={(e) => {
                                  const v = e.target.value.trim();
                                  if (v === "") {
                                    updateDraftRow(row.symbol, { entryPrice: undefined });
                                    return;
                                  }
                                  const n = Number(v);
                                  updateDraftRow(row.symbol, {
                                    entryPrice: Number.isFinite(n) ? n : undefined
                                  });
                                }}
                              />
                            </div>
                          ) : (
                            formatEntryCell(row)
                          )}
                        </td>
                        {/* TODO(options-scanner): show rationale / scanner snippet per row when available */}
                        <td className="xf-watchlist-table-mono">—</td>
                        <td>
                          <button
                            aria-label={`Remove ${row.symbol}`}
                            className="xf-watchlist-action-icon"
                            disabled={mutating && !editMode}
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
            {footerMode === "admin" ? (
              <>
                <Link className="cta cta-secondary" href="/admin/portfolios">
                  ← Portfolios
                </Link>
                <Link className="cta cta-secondary" href={`/admin/accounts/${encodeURIComponent(portfolioId)}`}>
                  Manage accounts
                </Link>
              </>
            ) : (
              <>
                <Link className="cta cta-secondary" href="/portfolio">
                  Back to portfolio
                </Link>
                {isAdmin ? (
                  <Link className="cta cta-primary" href="/admin/portfolios">
                    Open in admin console
                  </Link>
                ) : null}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
