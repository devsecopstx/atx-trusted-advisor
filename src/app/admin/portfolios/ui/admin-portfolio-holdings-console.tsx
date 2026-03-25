"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState, type Dispatch, type SetStateAction } from "react";

import { AddIcon, DeleteIcon, EditIcon, RefreshIcon } from "@/app/admin/ui/crud-icons";
import { parseJson } from "@/app/admin/ui/http";
import { positionOptionTypeValues, positionTypeValues, type PositionType } from "@/modules/core-admin/types";

type StockPosition = {
  _id: string;
  type: "stock";
  symbol: string;
  shares: number;
  purchasePrice: number;
  createdAt: string;
  updatedAt: string;
};

type OptionPosition = {
  _id: string;
  type: "option";
  symbol: string;
  yahooRef: string;
  optionType: "call" | "put";
  strike: number;
  expiration: string;
  contracts: number;
  premiumPerContract: number;
  createdAt: string;
  updatedAt: string;
};

type CashPosition = {
  _id: string;
  type: "cash";
  label: string;
  amount: number;
  amountFormatted: string;
  createdAt: string;
  updatedAt: string;
};

type ApiPosition = StockPosition | OptionPosition | CashPosition;

type HoldingsPayload = {
  data: {
    portfolioId: string;
    portfolioName: string;
    portfolioUserId: string;
    account: {
      _id: string;
      name: string;
      extAccountId: string;
      type: string;
      isDefault: boolean;
    };
    positions: ApiPosition[];
  };
};

type AdminPortfolioHoldingsConsoleProps = {
  portfolioId: string;
  accountId: string;
};

function isStock(p: ApiPosition): p is StockPosition {
  return p.type === "stock";
}
function isOption(p: ApiPosition): p is OptionPosition {
  return p.type === "option";
}
function isCash(p: ApiPosition): p is CashPosition {
  return p.type === "cash";
}

function normalizeApiPosition(raw: unknown): ApiPosition | null {
  if (!raw || typeof raw !== "object") {
    return null;
  }
  const o = raw as Record<string, unknown>;
  const id = typeof o._id === "string" ? o._id : "";
  const t = o.type;
  const createdAt = typeof o.createdAt === "string" ? o.createdAt : "";
  const updatedAt = typeof o.updatedAt === "string" ? o.updatedAt : "";
  if (!id || !createdAt || !updatedAt) {
    return null;
  }
  if (t === "stock") {
    return {
      _id: id,
      type: "stock",
      symbol: String(o.symbol ?? ""),
      shares: Number(o.shares),
      purchasePrice: Number(o.purchasePrice),
      createdAt,
      updatedAt
    };
  }
  if (t === "cash") {
    return {
      _id: id,
      type: "cash",
      label: String(o.label ?? "CASH"),
      amount: Number(o.amount),
      amountFormatted: String(o.amountFormatted ?? ""),
      createdAt,
      updatedAt
    };
  }
  if (t === "option") {
    const strike = Number(o.strike);
    const contracts = Number(o.contracts);
    const premiumPerContract = Number(o.premiumPerContract);
    if (
      !Number.isFinite(strike) ||
      !Number.isFinite(contracts) ||
      !Number.isFinite(premiumPerContract)
    ) {
      return null;
    }
    return {
      _id: id,
      type: "option",
      symbol: String(o.symbol ?? ""),
      yahooRef: String(o.yahooRef ?? ""),
      optionType: o.optionType === "put" ? "put" : "call",
      strike,
      expiration: String(o.expiration ?? ""),
      contracts,
      premiumPerContract,
      createdAt,
      updatedAt
    };
  }
  return null;
}

type HoldingsRowEditorProps = {
  row: ApiPosition;
  postJson: (body: Record<string, unknown>, okMsg: string) => Promise<void>;
  setStatus: Dispatch<SetStateAction<string>>;
};

function HoldingsRowEditor({ row, postJson, setStatus }: HoldingsRowEditorProps) {
  const [st, setSt] = useState(() =>
    isStock(row)
      ? { symbol: row.symbol, shares: String(row.shares), purchasePrice: String(row.purchasePrice) }
      : null
  );
  const [op, setOp] = useState(() =>
    isOption(row)
      ? {
          symbol: row.symbol,
          yahooRef: row.yahooRef,
          optionType: row.optionType,
          strike: String(row.strike),
          expiration: row.expiration,
          contracts: String(row.contracts),
          premiumPerContract: String(row.premiumPerContract)
        }
      : null
  );
  const [ca, setCa] = useState(() => (isCash(row) ? { label: row.label, amount: String(row.amount) } : null));

  const save = async () => {
    if (isStock(row) && st) {
      const symbol = st.symbol.trim().toUpperCase();
      const shares = Number.parseFloat(st.shares);
      const purchasePrice = Number.parseFloat(st.purchasePrice.replaceAll(/[$,\s]/g, ""));
      if (!symbol || !Number.isFinite(shares) || shares <= 0 || !Number.isFinite(purchasePrice) || purchasePrice < 0) {
        setStatus("Invalid stock fields");
        return;
      }
      await postJson({ type: "stock", symbol, shares, purchasePrice }, "Updated");
      return;
    }
    if (isOption(row) && op) {
      const symbol = op.symbol.trim().toUpperCase();
      const yahooRef = op.yahooRef.trim();
      const strike = Number.parseFloat(op.strike);
      const contracts = Number.parseFloat(op.contracts);
      const premiumPerContract = Number.parseFloat(op.premiumPerContract.replaceAll(/[$,\s]/g, ""));
      if (!symbol || !yahooRef || !/^\d{4}-\d{2}-\d{2}$/.test(op.expiration)) {
        setStatus("Invalid option fields");
        return;
      }
      if (!Number.isFinite(strike) || strike <= 0 || !Number.isFinite(contracts) || contracts <= 0) {
        setStatus("Invalid strike/contracts");
        return;
      }
      if (!Number.isFinite(premiumPerContract) || premiumPerContract < 0) {
        setStatus("Invalid premium");
        return;
      }
      await postJson(
        {
          type: "option",
          symbol,
          yahooRef,
          optionType: op.optionType,
          strike,
          expiration: op.expiration,
          contracts,
          premiumPerContract
        },
        "Updated"
      );
      return;
    }
    if (isCash(row) && ca) {
      const amount = Number.parseFloat(ca.amount.replaceAll(/[$,\s]/g, ""));
      if (!Number.isFinite(amount) || amount < 0) {
        setStatus("Invalid cash amount");
        return;
      }
      const label = ca.label.trim().toUpperCase() || "CASH";
      await postJson({ type: "cash", amount, label }, "Updated");
    }
  };

  if (isStock(row) && st) {
    return (
      <div className="tool-row" style={{ flexWrap: "wrap", gap: "0.5rem", alignItems: "center" }}>
        <input
          className="crud-input font-mono text-xs"
          value={st.symbol}
          onChange={(e) => setSt((s) => (s ? { ...s, symbol: e.target.value } : s))}
          aria-label="Symbol"
        />
        <input
          className="crud-input font-mono text-xs tabular-nums"
          value={st.shares}
          onChange={(e) => setSt((s) => (s ? { ...s, shares: e.target.value } : s))}
          aria-label="Shares"
        />
        <input
          className="crud-input font-mono text-xs tabular-nums"
          value={st.purchasePrice}
          onChange={(e) => setSt((s) => (s ? { ...s, purchasePrice: e.target.value } : s))}
          aria-label="Purchase price"
        />
        <button type="button" className="cta cta-secondary" onClick={() => void save()}>
          <EditIcon className="crud-icon" />
        </button>
      </div>
    );
  }
  if (isOption(row) && op) {
    return (
      <div className="stack-gap" style={{ display: "flex", flexDirection: "column", gap: "0.35rem" }}>
        <div className="tool-row" style={{ flexWrap: "wrap", gap: "0.35rem" }}>
          <input
            className="crud-input font-mono text-xs"
            value={op.symbol}
            onChange={(e) => setOp((s) => (s ? { ...s, symbol: e.target.value } : s))}
            placeholder="Underlying"
          />
          <input
            className="crud-input font-mono text-xs"
            style={{ minWidth: "12rem" }}
            value={op.yahooRef}
            onChange={(e) => setOp((s) => (s ? { ...s, yahooRef: e.target.value } : s))}
            placeholder="yahoo_ref"
          />
          <select
            className="crud-input text-xs"
            value={op.optionType}
            onChange={(e) =>
              setOp((s) => (s ? { ...s, optionType: e.target.value as "call" | "put" } : s))
            }
          >
            {positionOptionTypeValues.map((v) => (
              <option key={v} value={v}>
                {v}
              </option>
            ))}
          </select>
          <input
            className="crud-input font-mono text-xs tabular-nums"
            value={op.strike}
            onChange={(e) => setOp((s) => (s ? { ...s, strike: e.target.value } : s))}
            placeholder="Strike"
          />
          <input
            className="crud-input font-mono text-xs"
            value={op.expiration}
            onChange={(e) => setOp((s) => (s ? { ...s, expiration: e.target.value } : s))}
            placeholder="YYYY-MM-DD"
          />
          <input
            className="crud-input font-mono text-xs tabular-nums"
            value={op.contracts}
            onChange={(e) => setOp((s) => (s ? { ...s, contracts: e.target.value } : s))}
            placeholder="Contracts"
          />
          <input
            className="crud-input font-mono text-xs tabular-nums"
            value={op.premiumPerContract}
            onChange={(e) => setOp((s) => (s ? { ...s, premiumPerContract: e.target.value } : s))}
            placeholder="Premium/contract"
          />
          <button type="button" className="cta cta-secondary" onClick={() => void save()}>
            <EditIcon className="crud-icon" />
          </button>
        </div>
      </div>
    );
  }
  if (isCash(row) && ca) {
    return (
      <div className="tool-row" style={{ flexWrap: "wrap", gap: "0.5rem", alignItems: "center" }}>
        <input
          className="crud-input font-mono text-xs"
          value={ca.label}
          onChange={(e) => setCa((s) => (s ? { ...s, label: e.target.value } : s))}
          placeholder="Label"
        />
        <input
          className="crud-input font-mono text-xs tabular-nums"
          value={ca.amount}
          onChange={(e) => setCa((s) => (s ? { ...s, amount: e.target.value } : s))}
          placeholder="Amount"
        />
        <button type="button" className="cta cta-secondary" onClick={() => void save()}>
          <EditIcon className="crud-icon" />
        </button>
      </div>
    );
  }
  return null;
}

export function AdminPortfolioHoldingsConsole({ portfolioId, accountId }: AdminPortfolioHoldingsConsoleProps) {
  const [meta, setMeta] = useState<HoldingsPayload["data"] | null>(null);
  const [positions, setPositions] = useState<ApiPosition[]>([]);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState("Loading…");

  const [addType, setAddType] = useState<PositionType>("stock");
  const [stSym, setStSym] = useState("");
  const [stShares, setStShares] = useState("");
  const [stPx, setStPx] = useState("");

  const [opSym, setOpSym] = useState("");
  const [opYref, setOpYref] = useState("");
  const [opCp, setOpCp] = useState<"call" | "put">("call");
  const [opStrike, setOpStrike] = useState("");
  const [opExp, setOpExp] = useState("");
  const [opContracts, setOpContracts] = useState("");
  const [opPrem, setOpPrem] = useState("");

  const [caLabel, setCaLabel] = useState("");
  const [caAmt, setCaAmt] = useState("");

  const basePath = `/api/admin/portfolios/${encodeURIComponent(portfolioId)}/accounts/${encodeURIComponent(accountId)}/positions`;

  const refresh = useCallback(async () => {
    setLoading(true);
    setStatus("Loading holdings…");
    try {
      const payload = await parseJson<HoldingsPayload>(await fetch(basePath, { cache: "no-store" }));
      const normalized = payload.data.positions
        .map((p) => normalizeApiPosition(p))
        .filter((p): p is ApiPosition => p !== null);
      setMeta(payload.data);
      setPositions(normalized);
      setStatus(`Loaded ${normalized.length} position(s)`);
    } catch (e) {
      setStatus(e instanceof Error ? e.message : "Failed to load");
      setMeta(null);
      setPositions([]);
    } finally {
      setLoading(false);
    }
  }, [basePath]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const deleteRow = async (row: ApiPosition) => {
    const label = isCash(row) ? row.amountFormatted : isOption(row) ? row.yahooRef || row.symbol : row.symbol;
    if (!window.confirm(`Delete this position (${label})?`)) {
      return;
    }
    setStatus("Deleting…");
    try {
      await parseJson(
        await fetch(`${basePath}/${encodeURIComponent(row._id)}`, { method: "DELETE" })
      );
      setStatus("Deleted");
      void refresh();
    } catch (e) {
      setStatus(e instanceof Error ? e.message : "Delete failed");
    }
  };

  const postJson = async (body: Record<string, unknown>, okMsg: string) => {
    setStatus("Saving…");
    try {
      await parseJson(
        await fetch(basePath, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body)
        })
      );
      setStatus(okMsg);
      void refresh();
    } catch (e) {
      setStatus(e instanceof Error ? e.message : "Request failed");
    }
  };

  const addPosition = async () => {
    if (addType === "stock") {
      const symbol = stSym.trim().toUpperCase();
      const shares = Number.parseFloat(stShares);
      const purchasePrice = Number.parseFloat(stPx.replaceAll(/[$,\s]/g, ""));
      if (!symbol || !Number.isFinite(shares) || shares <= 0) {
        setStatus("Stock: enter symbol and positive shares");
        return;
      }
      if (!Number.isFinite(purchasePrice) || purchasePrice < 0) {
        setStatus("Stock: enter a non-negative purchase price");
        return;
      }
      await postJson({ type: "stock", symbol, shares, purchasePrice }, "Stock saved");
      setStSym("");
      setStShares("");
      setStPx("");
      return;
    }
    if (addType === "option") {
      const symbol = opSym.trim().toUpperCase();
      const yahooRef = opYref.trim();
      const strike = Number.parseFloat(opStrike);
      const contracts = Number.parseFloat(opContracts);
      const premiumPerContract = Number.parseFloat(opPrem.replaceAll(/[$,\s]/g, ""));
      const expiration = opExp.trim();
      if (!symbol || !yahooRef) {
        setStatus("Option: underlying symbol and yahoo_ref required");
        return;
      }
      if (!/^\d{4}-\d{2}-\d{2}$/.test(expiration)) {
        setStatus("Option: expiration must be YYYY-MM-DD");
        return;
      }
      if (!Number.isFinite(strike) || strike <= 0 || !Number.isFinite(contracts) || contracts <= 0) {
        setStatus("Option: strike and contracts must be positive numbers");
        return;
      }
      if (!Number.isFinite(premiumPerContract) || premiumPerContract < 0) {
        setStatus("Option: premium per contract must be non-negative");
        return;
      }
      await postJson(
        {
          type: "option",
          symbol,
          yahooRef,
          optionType: opCp,
          strike,
          expiration,
          contracts,
          premiumPerContract
        },
        "Option saved"
      );
      setOpSym("");
      setOpYref("");
      setOpStrike("");
      setOpExp("");
      setOpContracts("");
      setOpPrem("");
      return;
    }
    const amount = Number.parseFloat(caAmt.replaceAll(/[$,\s]/g, ""));
    if (!Number.isFinite(amount) || amount < 0) {
      setStatus("Cash: enter a non-negative amount");
      return;
    }
    const label = caLabel.trim().toUpperCase() || undefined;
    await postJson({ type: "cash", amount, ...(label ? { label } : {}) }, "Cash saved");
    setCaLabel("");
    setCaAmt("");
  };

  const summary = useMemo(() => {
    return (p: ApiPosition) => {
      if (isStock(p)) {
        return `${p.symbol} · ${p.shares} sh @ $${p.purchasePrice.toFixed(4)}`;
      }
      if (isOption(p)) {
        return `${p.symbol} ${p.optionType} ${p.strike} ${p.expiration} · ${p.yahooRef || "—"}`;
      }
      return `${p.label}: ${p.amountFormatted}`;
    };
  }, []);

  const pid = encodeURIComponent(portfolioId);

  return (
    <section className="panel stack-gap">
      <div className="tool-row" style={{ flexWrap: "wrap", gap: "0.5rem", alignItems: "center" }}>
        <Link className="cta cta-secondary" href={`/admin/portfolios/${pid}/accounts`}>
          ← Accounts
        </Link>
        <Link className="cta cta-secondary" href="/admin/portfolios">
          All portfolios
        </Link>
        <button className="cta cta-secondary" disabled={loading} onClick={() => void refresh()} type="button">
          <RefreshIcon className="crud-icon" /> Refresh
        </button>
        <p className="status-text">{status}</p>
      </div>

      {meta ? (
        <article className="surface-card xf-widget section-card">
          <h2 className="hero-title" style={{ fontSize: "1.25rem" }}>
            Holdings — {meta.account.name}
          </h2>
          <p className="status-text font-mono text-xs">Portfolio: {meta.portfolioName}</p>
          <p className="status-text font-mono text-xs">Portfolio ID: {meta.portfolioId}</p>
          <p className="status-text font-mono text-xs">User: {meta.portfolioUserId}</p>
          <p className="status-text font-mono text-xs">Account ID: {meta.account._id}</p>
          <p className="status-text text-sm" style={{ marginTop: "0.5rem" }}>
            <strong>Stock:</strong> symbol, shares, purchase price. <strong>Option:</strong> underlying, Yahoo ref, call/put,
            strike, expiration (YYYY-MM-DD), contracts, premium per contract. <strong>Cash:</strong> amount (USD); optional
            label (defaults to CASH).
          </p>
        </article>
      ) : null}

      <article className="surface-card xf-widget section-card">
        <h3>Positions</h3>
        {positions.length === 0 ? (
          <p className="status-text text-sm">No positions — add one below.</p>
        ) : (
          <ul className="stack-gap" style={{ listStyle: "none", padding: 0, margin: 0 }}>
            {positions.map((row) => (
              <li
                key={row._id}
                className="surface-card xf-widget"
                style={{ padding: "0.75rem", marginBottom: "0.5rem" }}
              >
                <div className="tool-row" style={{ justifyContent: "space-between", flexWrap: "wrap", gap: "0.5rem" }}>
                  <span className="status-text text-xs font-mono uppercase" style={{ color: "var(--xf-gain-green)" }}>
                    {row.type}
                  </span>
                  <span className="status-text text-sm" style={{ flex: "1 1 12rem" }}>
                    {summary(row)}
                  </span>
                  <button
                    type="button"
                    className="cta cta-secondary"
                    title="Delete"
                    onClick={() => void deleteRow(row)}
                  >
                    <DeleteIcon className="crud-icon" />
                  </button>
                </div>
                <div style={{ marginTop: "0.5rem" }}>
                  <HoldingsRowEditor
                    key={`${row._id}-${row.updatedAt}`}
                    row={row}
                    postJson={postJson}
                    setStatus={setStatus}
                  />
                </div>
              </li>
            ))}
          </ul>
        )}
      </article>

      <article className="surface-card xf-widget section-card">
        <h4 className="text-sm font-semibold">
          <AddIcon className="crud-icon" /> New position
        </h4>
        <div className="tool-row" style={{ marginTop: "0.5rem", marginBottom: "0.75rem" }}>
          <span className="status-text text-xs">Type:</span>
          <select
            className="crud-input text-xs"
            value={addType}
            onChange={(e) => setAddType(e.target.value as PositionType)}
          >
            {positionTypeValues.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </div>

        {addType === "stock" ? (
          <div className="tool-row" style={{ flexWrap: "wrap", gap: "0.75rem", alignItems: "flex-end" }}>
            <label className="status-text stack-gap" style={{ display: "flex", flexDirection: "column", gap: "0.25rem" }}>
              Symbol
              <input className="crud-input font-mono" value={stSym} onChange={(e) => setStSym(e.target.value)} />
            </label>
            <label className="status-text stack-gap" style={{ display: "flex", flexDirection: "column", gap: "0.25rem" }}>
              Shares
              <input className="crud-input font-mono tabular-nums" value={stShares} onChange={(e) => setStShares(e.target.value)} />
            </label>
            <label className="status-text stack-gap" style={{ display: "flex", flexDirection: "column", gap: "0.25rem" }}>
              Purchase price
              <input className="crud-input font-mono tabular-nums" value={stPx} onChange={(e) => setStPx(e.target.value)} />
            </label>
            <button type="button" className="cta cta-primary" onClick={() => void addPosition()}>
              Add stock
            </button>
          </div>
        ) : null}

        {addType === "option" ? (
          <div className="stack-gap" style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
            <div className="tool-row" style={{ flexWrap: "wrap", gap: "0.5rem", alignItems: "flex-end" }}>
              <label className="status-text stack-gap" style={{ display: "flex", flexDirection: "column", gap: "0.25rem" }}>
                Underlying
                <input className="crud-input font-mono text-xs" value={opSym} onChange={(e) => setOpSym(e.target.value)} />
              </label>
              <label className="status-text stack-gap" style={{ display: "flex", flexDirection: "column", gap: "0.25rem" }}>
                Yahoo ref
                <input
                  className="crud-input font-mono text-xs"
                  style={{ minWidth: "14rem" }}
                  value={opYref}
                  onChange={(e) => setOpYref(e.target.value)}
                />
              </label>
              <label className="status-text stack-gap" style={{ display: "flex", flexDirection: "column", gap: "0.25rem" }}>
                Call / Put
                <select className="crud-input text-xs" value={opCp} onChange={(e) => setOpCp(e.target.value as "call" | "put")}>
                  {positionOptionTypeValues.map((v) => (
                    <option key={v} value={v}>
                      {v}
                    </option>
                  ))}
                </select>
              </label>
              <label className="status-text stack-gap" style={{ display: "flex", flexDirection: "column", gap: "0.25rem" }}>
                Strike
                <input className="crud-input font-mono text-xs" value={opStrike} onChange={(e) => setOpStrike(e.target.value)} />
              </label>
              <label className="status-text stack-gap" style={{ display: "flex", flexDirection: "column", gap: "0.25rem" }}>
                Expiration
                <input
                  className="crud-input font-mono text-xs"
                  placeholder="YYYY-MM-DD"
                  value={opExp}
                  onChange={(e) => setOpExp(e.target.value)}
                />
              </label>
              <label className="status-text stack-gap" style={{ display: "flex", flexDirection: "column", gap: "0.25rem" }}>
                Contracts
                <input
                  className="crud-input font-mono text-xs"
                  value={opContracts}
                  onChange={(e) => setOpContracts(e.target.value)}
                />
              </label>
              <label className="status-text stack-gap" style={{ display: "flex", flexDirection: "column", gap: "0.25rem" }}>
                Premium / contract
                <input className="crud-input font-mono text-xs" value={opPrem} onChange={(e) => setOpPrem(e.target.value)} />
              </label>
              <button type="button" className="cta cta-primary" onClick={() => void addPosition()}>
                Add option
              </button>
            </div>
          </div>
        ) : null}

        {addType === "cash" ? (
          <div className="tool-row" style={{ flexWrap: "wrap", gap: "0.75rem", alignItems: "flex-end" }}>
            <label className="status-text stack-gap" style={{ display: "flex", flexDirection: "column", gap: "0.25rem" }}>
              Label (optional)
              <input className="crud-input font-mono text-xs" value={caLabel} onChange={(e) => setCaLabel(e.target.value)} placeholder="CASH" />
            </label>
            <label className="status-text stack-gap" style={{ display: "flex", flexDirection: "column", gap: "0.25rem" }}>
              Amount (USD)
              <input className="crud-input font-mono tabular-nums" value={caAmt} onChange={(e) => setCaAmt(e.target.value)} />
            </label>
            <button type="button" className="cta cta-primary" onClick={() => void addPosition()}>
              Add cash
            </button>
          </div>
        ) : null}
      </article>
    </section>
  );
}
