"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition, type FormEvent } from "react";

import type { PositionType } from "@/modules/core-admin/types";

export type SerializableAccount = {
  _id: string;
  name: string;
  type: string;
  extAccountId: string;
  cashBalance: number;
  isDefault: boolean;
};

export type SerializableStockPosition = {
  _id: string;
  type: "stock";
  symbol: string;
  shares: number;
  purchasePrice: number;
};

export type SerializableCashPosition = {
  _id: string;
  type: "cash";
  label: string;
  amount: number;
  amountFormatted: string;
};

export type SerializableOptionPosition = {
  _id: string;
  type: "option";
  symbol: string;
  yahooRef: string;
  optionType: "call" | "put";
  strike: number;
  expiration: string;
  contracts: number;
  premiumPerContract: number;
};

export type SerializablePosition =
  | SerializableStockPosition
  | SerializableCashPosition
  | SerializableOptionPosition;

type AccountWorkspaceProps = {
  portfolioId: string;
  account: SerializableAccount;
  initialPositions: SerializablePosition[];
};

function formatBrokerType(type: string): string {
  return type
    .split(/[-_]/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(" ");
}

function positionSummary(p: SerializablePosition): string {
  if (p.type === "stock") {
    return `${p.symbol} · ${p.shares} sh @ ${p.purchasePrice.toLocaleString("en-US", { style: "currency", currency: "USD" })}`;
  }
  if (p.type === "cash") {
    return `${p.label}: ${p.amountFormatted}`;
  }
  return `${p.symbol} ${p.optionType.toUpperCase()} ${p.strike} ${p.expiration} · ${p.yahooRef || "—"} · ${p.contracts}× @ ${p.premiumPerContract.toFixed(2)}/ct`;
}

export function AccountWorkspace({ portfolioId, account, initialPositions }: AccountWorkspaceProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [positions, setPositions] = useState(initialPositions);

  const [acctName, setAcctName] = useState(account.name);
  const [cashBalance, setCashBalance] = useState(String(account.cashBalance));
  const [extRef, setExtRef] = useState(account.extAccountId);

  const [holdingType, setHoldingType] = useState<PositionType>("stock");

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

  useEffect(() => {
    setPositions(initialPositions);
  }, [initialPositions]);

  useEffect(() => {
    setAcctName(account.name);
    setCashBalance(String(account.cashBalance));
    setExtRef(account.extAccountId);
  }, [account.name, account.cashBalance, account.extAccountId]);

  async function saveAccount(e: FormEvent) {
    e.preventDefault();
    setError(null);
    const cash = Number(cashBalance);
    if (!Number.isFinite(cash) || cash < 0) {
      setError("Cash balance must be a non-negative number.");
      return;
    }
    const res = await fetch(
      `/api/portfolios/${encodeURIComponent(portfolioId)}/accounts/${encodeURIComponent(account._id)}`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: acctName.trim() || undefined,
          cashBalance: cash,
          extAccountId: extRef.trim() || undefined
        })
      }
    );
    const body = (await res.json().catch(() => ({}))) as { error?: string };
    if (!res.ok) {
      setError(body.error ?? "Could not update account");
      return;
    }
    startTransition(() => router.refresh());
  }

  async function addHolding(e: FormEvent) {
    e.preventDefault();
    setError(null);

    if (holdingType === "stock") {
      const symbol = stSym.trim().toUpperCase();
      const qty = Number.parseFloat(stShares);
      const avgCost = Number.parseFloat(stPx);
      if (!symbol || !Number.isFinite(qty) || qty <= 0) {
        setError("Stock: symbol and positive shares required.");
        return;
      }
      if (!Number.isFinite(avgCost) || avgCost < 0) {
        setError("Stock: non-negative purchase price required.");
        return;
      }
      const res = await fetch("/api/positions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          portfolioId,
          accountId: account._id,
          symbol,
          qty,
          avgCost,
          type: "stock"
        })
      });
      const body = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setError(body.error ?? "Could not save stock position");
        return;
      }
      setStSym("");
      setStShares("");
      setStPx("");
      startTransition(() => router.refresh());
      return;
    }

    if (holdingType === "option") {
      const symbol = opSym.trim().toUpperCase();
      const yahooRef = opYref.trim();
      const strike = Number.parseFloat(opStrike);
      const qty = Number.parseFloat(opContracts);
      const avgCost = Number.parseFloat(opPrem);
      const expiration = opExp.trim();
      if (!symbol || !yahooRef) {
        setError("Option: underlying and yahoo_ref required.");
        return;
      }
      if (!/^\d{4}-\d{2}-\d{2}$/.test(expiration)) {
        setError("Option: expiration must be YYYY-MM-DD.");
        return;
      }
      if (!Number.isFinite(strike) || strike <= 0 || !Number.isFinite(qty) || qty <= 0) {
        setError("Option: positive strike and contracts required.");
        return;
      }
      if (!Number.isFinite(avgCost) || avgCost < 0) {
        setError("Option: non-negative premium per contract required.");
        return;
      }
      const res = await fetch("/api/positions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          portfolioId,
          accountId: account._id,
          type: "option",
          ticker: symbol,
          yahooRef,
          optionType: opCp,
          strike,
          expiration,
          contracts: qty,
          premium: avgCost
        })
      });
      const body = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setError(body.error ?? "Could not save option position");
        return;
      }
      setOpSym("");
      setOpYref("");
      setOpStrike("");
      setOpExp("");
      setOpContracts("");
      setOpPrem("");
      startTransition(() => router.refresh());
      return;
    }

    const amount = Number.parseFloat(caAmt.replaceAll(/[$,\s]/g, ""));
    if (!Number.isFinite(amount) || amount < 0) {
      setError("Cash: non-negative amount required.");
      return;
    }
    const label = caLabel.trim().toUpperCase() || "CASH";
    const res = await fetch("/api/positions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        portfolioId,
        accountId: account._id,
        type: "cash",
        ticker: label,
        amount,
        shares: 1
      })
    });
    const body = (await res.json().catch(() => ({}))) as { error?: string };
    if (!res.ok) {
      setError(body.error ?? "Could not save cash position");
      return;
    }
    setCaLabel("");
    setCaAmt("");
    startTransition(() => router.refresh());
  }

  async function removePosition(positionId: string) {
    setError(null);
    const qs = new URLSearchParams({ portfolioId, accountId: account._id });
    const res = await fetch(
      `/api/positions/${encodeURIComponent(positionId)}?${qs.toString()}`,
      { method: "DELETE" }
    );
    if (!res.ok) {
      const body = (await res.json().catch(() => ({}))) as { error?: string };
      setError(body.error ?? "Could not delete position");
      return;
    }
    setPositions((prev) => prev.filter((p) => p._id !== positionId));
    startTransition(() => router.refresh());
  }

  return (
    <div className="stack-gap" style={{ marginTop: "1.25rem" }}>
      <p className="hero-copy" style={{ fontSize: "0.9rem", marginBottom: 0 }}>
        Holdings support <strong>stock</strong> (symbol, shares, purchase price), <strong>options</strong> (Yahoo ref,
        call/put, strike, expiration, contracts, premium per contract), and <strong>cash</strong> (USD amount, optional
        label).
      </p>

      {error ? (
        <p className="status-text status-error" role="alert">
          {error}
        </p>
      ) : null}

      <section>
        <h2
          style={{
            fontSize: "1rem",
            fontWeight: 600,
            margin: "0 0 0.5rem",
            color: "var(--xf-text-100)"
          }}
        >
          Account details
        </h2>
        <form onSubmit={saveAccount} className="stack-gap" style={{ maxWidth: "28rem" }}>
          <label className="stack-gap" style={{ gap: "0.25rem", display: "flex", flexDirection: "column" }}>
            <span style={{ color: "var(--xf-text-300)", fontSize: "0.85rem" }}>Display name</span>
            <input
              className="crud-input"
              value={acctName}
              onChange={(e) => setAcctName(e.target.value)}
              required
            />
          </label>
          <label className="stack-gap" style={{ gap: "0.25rem", display: "flex", flexDirection: "column" }}>
            <span style={{ color: "var(--xf-text-300)", fontSize: "0.85rem" }}>Cash balance (USD)</span>
            <input
              className="crud-input"
              type="number"
              min={0}
              step="0.01"
              value={cashBalance}
              onChange={(e) => setCashBalance(e.target.value)}
              required
            />
          </label>
          <label className="stack-gap" style={{ gap: "0.25rem", display: "flex", flexDirection: "column" }}>
            <span style={{ color: "var(--xf-text-300)", fontSize: "0.85rem" }}>External reference</span>
            <input
              className="crud-input"
              value={extRef}
              onChange={(e) => setExtRef(e.target.value)}
              required
            />
          </label>
          <p className="status-text" style={{ fontSize: "0.8rem", margin: 0 }}>
            Broker type: <strong>{formatBrokerType(account.type)}</strong>
            {account.isDefault ? " · default account" : null}
          </p>
          <button type="submit" className="cta cta-primary" disabled={pending}>
            Save account
          </button>
        </form>
      </section>

      <section style={{ marginTop: "1.5rem" }}>
        <h2
          style={{
            fontSize: "1rem",
            fontWeight: 600,
            margin: "0 0 0.5rem",
            color: "var(--xf-text-100)"
          }}
        >
          Holdings
        </h2>
        {positions.length === 0 ? (
          <p className="status-text">No positions yet. Add one below.</p>
        ) : (
          <div className="crud-table-wrap">
            <table className="crud-table">
              <thead>
                <tr>
                  <th scope="col">Type</th>
                  <th scope="col">Details</th>
                  <th scope="col" />
                </tr>
              </thead>
              <tbody>
                {positions.map((p) => (
                  <tr key={p._id}>
                    <td className="text-xs" style={{ textTransform: "capitalize" }}>
                      {p.type}
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
                        onClick={() => removePosition(p._id)}
                      >
                        Remove
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <h3
          style={{
            fontSize: "0.9rem",
            fontWeight: 600,
            margin: "1rem 0 0.5rem",
            color: "var(--xf-text-200)"
          }}
        >
          Add or update (upsert)
        </h3>
        <form onSubmit={addHolding} className="stack-gap">
          <label className="stack-gap" style={{ gap: "0.25rem", display: "flex", flexDirection: "column", maxWidth: "12rem" }}>
            <span style={{ color: "var(--xf-text-300)", fontSize: "0.8rem" }}>Instrument type</span>
            <select
              className="crud-input"
              value={holdingType}
              onChange={(e) => setHoldingType(e.target.value as PositionType)}
              aria-label="Holding type"
            >
              <option value="stock">stock</option>
              <option value="option">option</option>
              <option value="cash">cash</option>
            </select>
          </label>

          {holdingType === "stock" ? (
            <div
              className="stack-gap"
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fill, minmax(8rem, 1fr))",
                gap: "0.75rem",
                maxWidth: "36rem",
                alignItems: "end"
              }}
            >
              <label className="stack-gap" style={{ gap: "0.25rem", display: "flex", flexDirection: "column" }}>
                <span style={{ color: "var(--xf-text-300)", fontSize: "0.8rem" }}>Symbol</span>
                <input className="crud-input" value={stSym} onChange={(e) => setStSym(e.target.value)} placeholder="TSLA" />
              </label>
              <label className="stack-gap" style={{ gap: "0.25rem", display: "flex", flexDirection: "column" }}>
                <span style={{ color: "var(--xf-text-300)", fontSize: "0.8rem" }}>Shares</span>
                <input
                  className="crud-input"
                  type="number"
                  min={0}
                  step="any"
                  value={stShares}
                  onChange={(e) => setStShares(e.target.value)}
                />
              </label>
              <label className="stack-gap" style={{ gap: "0.25rem", display: "flex", flexDirection: "column" }}>
                <span style={{ color: "var(--xf-text-300)", fontSize: "0.8rem" }}>Purchase price</span>
                <input
                  className="crud-input"
                  type="number"
                  min={0}
                  step="0.01"
                  value={stPx}
                  onChange={(e) => setStPx(e.target.value)}
                />
              </label>
              <button type="submit" className="cta cta-primary" disabled={pending}>
                Save
              </button>
            </div>
          ) : null}

          {holdingType === "option" ? (
            <div
              className="stack-gap"
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fill, minmax(7.5rem, 1fr))",
                gap: "0.75rem",
                maxWidth: "48rem",
                alignItems: "end"
              }}
            >
              <label className="stack-gap" style={{ gap: "0.25rem", display: "flex", flexDirection: "column" }}>
                <span style={{ color: "var(--xf-text-300)", fontSize: "0.8rem" }}>Underlying</span>
                <input className="crud-input" value={opSym} onChange={(e) => setOpSym(e.target.value)} />
              </label>
              <label className="stack-gap" style={{ gap: "0.25rem", display: "flex", flexDirection: "column" }}>
                <span style={{ color: "var(--xf-text-300)", fontSize: "0.8rem" }}>Yahoo ref</span>
                <input className="crud-input font-mono text-xs" value={opYref} onChange={(e) => setOpYref(e.target.value)} />
              </label>
              <label className="stack-gap" style={{ gap: "0.25rem", display: "flex", flexDirection: "column" }}>
                <span style={{ color: "var(--xf-text-300)", fontSize: "0.8rem" }}>Call / put</span>
                <select className="crud-input" value={opCp} onChange={(e) => setOpCp(e.target.value as "call" | "put")}>
                  <option value="call">call</option>
                  <option value="put">put</option>
                </select>
              </label>
              <label className="stack-gap" style={{ gap: "0.25rem", display: "flex", flexDirection: "column" }}>
                <span style={{ color: "var(--xf-text-300)", fontSize: "0.8rem" }}>Strike</span>
                <input className="crud-input" value={opStrike} onChange={(e) => setOpStrike(e.target.value)} />
              </label>
              <label className="stack-gap" style={{ gap: "0.25rem", display: "flex", flexDirection: "column" }}>
                <span style={{ color: "var(--xf-text-300)", fontSize: "0.8rem" }}>Expiration</span>
                <input
                  className="crud-input font-mono text-xs"
                  placeholder="YYYY-MM-DD"
                  value={opExp}
                  onChange={(e) => setOpExp(e.target.value)}
                />
              </label>
              <label className="stack-gap" style={{ gap: "0.25rem", display: "flex", flexDirection: "column" }}>
                <span style={{ color: "var(--xf-text-300)", fontSize: "0.8rem" }}>Contracts</span>
                <input className="crud-input" value={opContracts} onChange={(e) => setOpContracts(e.target.value)} />
              </label>
              <label className="stack-gap" style={{ gap: "0.25rem", display: "flex", flexDirection: "column" }}>
                <span style={{ color: "var(--xf-text-300)", fontSize: "0.8rem" }}>Premium / contract</span>
                <input className="crud-input" value={opPrem} onChange={(e) => setOpPrem(e.target.value)} />
              </label>
              <button type="submit" className="cta cta-primary" disabled={pending}>
                Save
              </button>
            </div>
          ) : null}

          {holdingType === "cash" ? (
            <div
              className="stack-gap"
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fill, minmax(8rem, 1fr))",
                gap: "0.75rem",
                maxWidth: "28rem",
                alignItems: "end"
              }}
            >
              <label className="stack-gap" style={{ gap: "0.25rem", display: "flex", flexDirection: "column" }}>
                <span style={{ color: "var(--xf-text-300)", fontSize: "0.8rem" }}>Label (optional)</span>
                <input className="crud-input" value={caLabel} onChange={(e) => setCaLabel(e.target.value)} placeholder="CASH" />
              </label>
              <label className="stack-gap" style={{ gap: "0.25rem", display: "flex", flexDirection: "column" }}>
                <span style={{ color: "var(--xf-text-300)", fontSize: "0.8rem" }}>Amount (USD)</span>
                <input className="crud-input" value={caAmt} onChange={(e) => setCaAmt(e.target.value)} />
              </label>
              <button type="submit" className="cta cta-primary" disabled={pending}>
                Save
              </button>
            </div>
          ) : null}
        </form>
      </section>

      <div className="cta-row" style={{ marginTop: "1.5rem" }}>
        <Link className="cta cta-secondary" href="/portfolio">
          ← Back to portfolio
        </Link>
      </div>
    </div>
  );
}
