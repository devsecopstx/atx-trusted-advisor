"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition, type FormEvent } from "react";

import { AddIcon } from "@/app/admin/ui/crud-icons";
import { StockSymbolLiveField } from "@/app/portfolio/ui/stock-symbol-live-field";

type AccountOption = {
  id: string;
  name: string;
  brokerType: string;
};

type PortfolioPositionQuickAddProps = {
  portfolioId: string;
  accounts: AccountOption[];
};

function formatBrokerType(type: string): string {
  return type
    .split(/[-_]/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(" ");
}

function parseIsoDateAtUtcMidnight(value: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return null;
  }
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function isFutureIsoDate(value: string): boolean {
  const parsed = parseIsoDateAtUtcMidnight(value);
  if (!parsed) {
    return false;
  }
  const now = new Date();
  const todayUtc = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  return parsed.getTime() > todayUtc.getTime();
}

export function PortfolioPositionQuickAdd({ portfolioId, accounts }: PortfolioPositionQuickAddProps) {
  const router = useRouter();
  const [, startNavTransition] = useTransition();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [accountId, setAccountId] = useState(accounts[0]?.id ?? "");
  const [type, setType] = useState<"stock" | "option" | "cash">("stock");
  const [ticker, setTicker] = useState("");
  const [shares, setShares] = useState("");
  const [contracts, setContracts] = useState("");
  const [optionType, setOptionType] = useState<"call" | "put">("call");
  const [strike, setStrike] = useState("");
  const [expiration, setExpiration] = useState("");
  const [purchasePrice, setPurchasePrice] = useState("");

  const selectedAccount = useMemo(
    () => accounts.find((account) => account.id === accountId),
    [accountId, accounts]
  );

  async function submitPosition(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setSuccess(null);

    if (!accountId) {
      setError("Select an account.");
      return;
    }
    const normalizedTicker = ticker.trim().toUpperCase();
    if (!normalizedTicker) {
      setError("Ticker is required.");
      return;
    }

    const sharesValue = Number(shares);
    const sharesIsValid = Number.isFinite(sharesValue) && sharesValue > 0;
    const contractsValue = Number(contracts);
    const contractsIsValid = Number.isFinite(contractsValue) && contractsValue > 0;

    if (type === "cash" && !sharesIsValid) {
      setError("Amount must be a positive number.");
      return;
    }
    if (type === "stock" && !sharesIsValid) {
      setError("Shares must be a positive number.");
      return;
    }
    if (type === "option" && !sharesIsValid && !contractsIsValid) {
      setError("Options require shares or contracts.");
      return;
    }
    if (type === "option") {
      const normalizedExpiration = expiration.trim();
      if (!normalizedExpiration) {
        setError("Expiration is required for option positions.");
        return;
      }
      if (!isFutureIsoDate(normalizedExpiration)) {
        setError("Expiration must be a future date in YYYY-MM-DD format.");
        return;
      }
    }

    const purchasePriceValue = Number(purchasePrice);
    if (!Number.isFinite(purchasePriceValue) || purchasePriceValue < 0) {
      setError(type === "cash" ? "Amount price must be non-negative." : "Purchase price must be non-negative.");
      return;
    }

    const body: {
      portfolioId: string;
      accountId: string;
      type: "stock" | "option" | "cash";
      ticker: string;
      purchasePrice: number;
      amount?: number;
      shares?: number;
      contracts?: number;
      optionType?: "call" | "put";
      strike?: number;
      expiration?: string;
    } = {
      portfolioId,
      accountId,
      type,
      ticker: normalizedTicker,
      purchasePrice: purchasePriceValue
    };

    if (type === "cash") {
      body.amount = sharesValue;
    } else if (type === "stock") {
      body.shares = sharesValue;
    } else {
      if (sharesIsValid) {
        body.shares = sharesValue;
      }
      if (contractsIsValid) {
        body.contracts = contractsValue;
      }
      body.optionType = optionType;
      const strikeValue = Number(strike);
      if (Number.isFinite(strikeValue) && strikeValue >= 0) {
        body.strike = strikeValue;
      }
      const normalizedExpiration = expiration.trim();
      if (normalizedExpiration) {
        body.expiration = normalizedExpiration;
      }
    }

    setPending(true);
    try {
      const response = await fetch("/api/positions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(body)
      });
      const payload = (await response.json().catch(() => ({}))) as { error?: string };
      if (!response.ok) {
        setError(payload.error ?? "Could not save position.");
        return;
      }
      setSuccess("Position saved.");
      setTicker("");
      setShares("");
      setContracts("");
      setOptionType("call");
      setStrike("");
      setExpiration("");
      setPurchasePrice("");
      startNavTransition(() => {
        router.refresh();
      });
    } catch {
      setError("Network error while saving position.");
    } finally {
      setPending(false);
    }
  }

  if (accounts.length === 0) {
    return (
      <p className="status-text" style={{ marginTop: "0.5rem" }}>
        No accounts available yet. Create or link an account first.
      </p>
    );
  }

  return (
    <section style={{ marginTop: "1.5rem" }}>
      <h2
        style={{
          fontSize: "1rem",
          fontWeight: 600,
          margin: "0 0 0.5rem",
          color: "var(--xf-text-100)"
        }}
      >
        Quick add position
      </h2>
      <p className="status-text" style={{ marginBottom: "0.75rem" }}>
        Use OpenAPI position shape fields (`type`, `ticker`, `shares`, `purchasePrice`) and choose the account.
        Option rows also support `contracts`, `optionType`, `strike`, and `expiration`.
      </p>
      {selectedAccount ? (
        <p className="status-text" style={{ marginBottom: "0.75rem", fontSize: "0.8rem" }}>
          Target account: <strong>{selectedAccount.name}</strong> ({formatBrokerType(selectedAccount.brokerType)})
        </p>
      ) : null}
      {error ? (
        <p className="status-text status-error" role="alert" style={{ marginBottom: "0.5rem" }}>
          {error}
        </p>
      ) : null}
      {success ? (
        <p className="status-text" style={{ marginBottom: "0.5rem" }}>
          {success}
        </p>
      ) : null}
      <form
        onSubmit={submitPosition}
        className="stack-gap"
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(9rem, 1fr))",
          gap: "0.75rem",
          alignItems: "end"
        }}
      >
        <label className="stack-gap" style={{ gap: "0.25rem", display: "flex", flexDirection: "column" }}>
          <span style={{ color: "var(--xf-text-300)", fontSize: "0.8rem" }}>Account</span>
          <select
            className="crud-input"
            value={accountId}
            onChange={(event) => setAccountId(event.target.value)}
            required
          >
            {accounts.map((account) => (
              <option value={account.id} key={account.id}>
                {account.name}
              </option>
            ))}
          </select>
        </label>
        <label className="stack-gap" style={{ gap: "0.25rem", display: "flex", flexDirection: "column" }}>
          <span style={{ color: "var(--xf-text-300)", fontSize: "0.8rem" }}>Type</span>
          <select
            className="crud-input"
            value={type}
            onChange={(event) => setType(event.target.value as "stock" | "option" | "cash")}
          >
            <option value="stock">stock</option>
            <option value="option">option</option>
            <option value="cash">cash</option>
          </select>
        </label>
        <label className="stack-gap" style={{ gap: "0.25rem", display: "flex", flexDirection: "column" }}>
          <span style={{ color: "var(--xf-text-300)", fontSize: "0.8rem" }}>Ticker</span>
          <input
            className="crud-input"
            value={ticker}
            onChange={(event) => setTicker(event.target.value)}
            placeholder={type === "cash" ? "USD" : "TSLA"}
            required
          />
        </label>
        {type === "stock" ? (
          <div className="stack-gap" style={{ gridColumn: "1 / -1", maxWidth: "28rem" }}>
            <StockSymbolLiveField
              purchasePrice={purchasePrice}
              symbolInput={ticker}
              onSuggestPurchasePrice={setPurchasePrice}
            />
          </div>
        ) : null}
        <label className="stack-gap" style={{ gap: "0.25rem", display: "flex", flexDirection: "column" }}>
          <span style={{ color: "var(--xf-text-300)", fontSize: "0.8rem" }}>
            {type === "cash" ? "Amount" : type === "option" ? "Shares (optional)" : "Shares"}
          </span>
          <input
            className="crud-input"
            type="number"
            min={0}
            step="any"
            value={shares}
            onChange={(event) => setShares(event.target.value)}
            placeholder={type === "cash" ? "5000" : "10"}
            required={type === "cash" || type === "stock"}
          />
        </label>
        {type === "option" ? (
          <>
            <label className="stack-gap" style={{ gap: "0.25rem", display: "flex", flexDirection: "column" }}>
              <span style={{ color: "var(--xf-text-300)", fontSize: "0.8rem" }}>Contracts (optional)</span>
              <input
                className="crud-input"
                type="number"
                min={0}
                step="1"
                value={contracts}
                onChange={(event) => setContracts(event.target.value)}
                placeholder="1"
              />
            </label>
            <label className="stack-gap" style={{ gap: "0.25rem", display: "flex", flexDirection: "column" }}>
              <span style={{ color: "var(--xf-text-300)", fontSize: "0.8rem" }}>Option type</span>
              <select
                className="crud-input"
                value={optionType}
                onChange={(event) => setOptionType(event.target.value as "call" | "put")}
              >
                <option value="call">call</option>
                <option value="put">put</option>
              </select>
            </label>
            <label className="stack-gap" style={{ gap: "0.25rem", display: "flex", flexDirection: "column" }}>
              <span style={{ color: "var(--xf-text-300)", fontSize: "0.8rem" }}>Strike (optional)</span>
              <input
                className="crud-input"
                type="number"
                min={0}
                step="0.01"
                value={strike}
                onChange={(event) => setStrike(event.target.value)}
                placeholder="250"
              />
            </label>
            <label className="stack-gap" style={{ gap: "0.25rem", display: "flex", flexDirection: "column" }}>
              <span style={{ color: "var(--xf-text-300)", fontSize: "0.8rem" }}>Expiration</span>
              <input
                className="crud-input"
                type="date"
                value={expiration}
                onChange={(event) => setExpiration(event.target.value)}
                required
              />
              <span className="status-text" style={{ fontSize: "0.72rem", marginTop: "-0.1rem" }}>
                Format: YYYY-MM-DD. Must be a future date.
              </span>
            </label>
          </>
        ) : null}
        <label className="stack-gap" style={{ gap: "0.25rem", display: "flex", flexDirection: "column" }}>
          <span style={{ color: "var(--xf-text-300)", fontSize: "0.8rem" }}>Purchase price</span>
          <input
            className="crud-input"
            type="number"
            min={0}
            step="0.01"
            value={purchasePrice}
            onChange={(event) => setPurchasePrice(event.target.value)}
            placeholder={type === "cash" ? "1.00" : "250.00"}
            required
          />
        </label>
        <button type="submit" className="cta cta-primary" disabled={pending}>
          <AddIcon className="crud-icon" />
          Add position
        </button>
      </form>
    </section>
  );
}
