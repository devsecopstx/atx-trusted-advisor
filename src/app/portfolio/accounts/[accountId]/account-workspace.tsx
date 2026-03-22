"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition, type FormEvent } from "react";

export type SerializableAccount = {
  _id: string;
  name: string;
  type: string;
  extAccountId: string;
  cashBalance: number;
  isDefault: boolean;
};

export type SerializablePosition = {
  _id: string;
  symbol: string;
  qty: number;
  avgCost: number;
};

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

export function AccountWorkspace({ portfolioId, account, initialPositions }: AccountWorkspaceProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [positions, setPositions] = useState(initialPositions);

  const [acctName, setAcctName] = useState(account.name);
  const [cashBalance, setCashBalance] = useState(String(account.cashBalance));
  const [extRef, setExtRef] = useState(account.extAccountId);

  const [sym, setSym] = useState("");
  const [shares, setShares] = useState("");
  const [purchasePrice, setPurchasePrice] = useState("");

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

  async function addOrUpdateHolding(e: FormEvent) {
    e.preventDefault();
    setError(null);
    const ticker = sym.trim().toUpperCase();
    const q = Number(shares);
    const px = Number(purchasePrice);
    if (!ticker) {
      setError("Ticker is required.");
      return;
    }
    if (!Number.isFinite(q) || q <= 0) {
      setError("Shares must be a positive number.");
      return;
    }
    if (!Number.isFinite(px) || px < 0) {
      setError("Average cost must be a non-negative number.");
      return;
    }
    const res = await fetch("/api/positions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        portfolioId,
        accountId: account._id,
        symbol: ticker,
        qty: q,
        avgCost: px
      })
    });
    const body = (await res.json().catch(() => ({}))) as { data?: SerializablePosition; error?: string };
    if (!res.ok) {
      setError(body.error ?? "Could not save position");
      return;
    }
    if (body.data?._id) {
      setPositions((prev) => {
        const next = prev.filter((p) => p.symbol !== body.data!.symbol);
        next.push({
          _id: body.data!._id,
          symbol: body.data!.symbol,
          qty: body.data!.qty,
          avgCost: body.data!.avgCost
        });
        return next.sort((a, b) => a.symbol.localeCompare(b.symbol));
      });
    }
    setSym("");
    setShares("");
    setPurchasePrice("");
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
        Holdings use the same core fields as xStrategyBuilder review flows:{" "}
        <strong>ticker</strong>, <strong>shares</strong>, and <strong>average cost</strong> (purchase
        price). Option legs and multi-leg structures are not stored on this record yet—use
        xStrategyBuilder for full strategy shapes until execution links land.
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
          <p className="status-text">No positions yet. Add a stock lot below.</p>
        ) : (
          <div className="crud-table-wrap">
            <table className="crud-table">
              <thead>
                <tr>
                  <th scope="col">Ticker</th>
                  <th scope="col">Shares</th>
                  <th scope="col">Avg cost</th>
                  <th scope="col" />
                </tr>
              </thead>
              <tbody>
                {positions.map((p) => (
                  <tr key={p._id}>
                    <td>
                      <code style={{ fontFamily: "ui-monospace, monospace", color: "var(--xf-text-300)" }}>
                        {p.symbol}
                      </code>
                    </td>
                    <td style={{ fontFamily: "ui-monospace, monospace", fontSize: "0.9rem" }}>{p.qty}</td>
                    <td style={{ fontFamily: "ui-monospace, monospace", fontSize: "0.9rem" }}>
                      {p.avgCost.toLocaleString("en-US", { style: "currency", currency: "USD" })}
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
          Add or update lot (upserts by ticker)
        </h3>
        <form
          onSubmit={addOrUpdateHolding}
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
            <span style={{ color: "var(--xf-text-300)", fontSize: "0.8rem" }}>Ticker</span>
            <input className="crud-input" value={sym} onChange={(e) => setSym(e.target.value)} placeholder="TSLA" />
          </label>
          <label className="stack-gap" style={{ gap: "0.25rem", display: "flex", flexDirection: "column" }}>
            <span style={{ color: "var(--xf-text-300)", fontSize: "0.8rem" }}>Shares</span>
            <input
              className="crud-input"
              type="number"
              min={0}
              step="any"
              value={shares}
              onChange={(e) => setShares(e.target.value)}
              placeholder="10"
            />
          </label>
          <label className="stack-gap" style={{ gap: "0.25rem", display: "flex", flexDirection: "column" }}>
            <span style={{ color: "var(--xf-text-300)", fontSize: "0.8rem" }}>Avg cost</span>
            <input
              className="crud-input"
              type="number"
              min={0}
              step="0.01"
              value={purchasePrice}
              onChange={(e) => setPurchasePrice(e.target.value)}
              placeholder="250.00"
            />
          </label>
          <button type="submit" className="cta cta-primary" disabled={pending}>
            Save lot
          </button>
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
