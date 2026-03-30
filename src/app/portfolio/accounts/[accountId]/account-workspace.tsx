"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition, type FormEvent } from "react";

import { BackIcon, DeleteIcon, SaveIcon, XMarkIcon } from "@/app/admin/ui/crud-icons";
import { AccountHoldingsLiveTable } from "@/app/portfolio/ui/account-holdings-live-table";
import { StockSymbolLiveField } from "@/app/portfolio/ui/stock-symbol-live-field";
import {
    INVESTMENT_STRATEGY_OPTIONS,
    RISK_LEVEL_OPTIONS
} from "@/modules/core-admin/portfolio-preference-labels";
import type { AccountOutlook, PositionType } from "@/modules/core-admin/types";

import type { SerializableAccount, SerializablePosition } from "@/app/portfolio/accounts/serializable-account";

export type { SerializableAccount, SerializablePosition } from "@/app/portfolio/accounts/serializable-account";

type AccountWorkspaceProps = {
  portfolioId: string;
  account: SerializableAccount;
  initialPositions: SerializablePosition[];
  /** Total accounts in the workspace portfolio (enables delete when there is more than one). */
  portfolioAccountCount: number;
};

function formatBrokerType(type: string): string {
  return type
    .split(/[-_]/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(" ");
}

export function AccountWorkspace({
  portfolioId,
  account,
  initialPositions,
  portfolioAccountCount
}: AccountWorkspaceProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [deletePending, setDeletePending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [positions, setPositions] = useState(initialPositions);

  const [acctName, setAcctName] = useState(account.name);
  const [cashBalance, setCashBalance] = useState(String(account.cashBalance));
  const [extRef, setExtRef] = useState(account.extAccountId);
  const [riskProfile, setRiskProfile] = useState<SerializableAccount["riskProfile"]>(account.riskProfile);
  const [outlook, setOutlook] = useState<AccountOutlook | null>(account.outlook);

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
    setRiskProfile(account.riskProfile);
    setOutlook(account.outlook);
  }, [account.name, account.cashBalance, account.extAccountId, account.riskProfile, account.outlook]);

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
          extAccountId: extRef.trim() || undefined,
          riskProfile,
          outlook
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
    <div className="portfolio-workspace">
      {error ? (
        <p className="status-text status-error" role="alert">
          {error}
        </p>
      ) : null}

      <section className="portfolio-edit-account-card xf-noise-overlay" aria-labelledby="edit-account-card-title">
        <h2 id="edit-account-card-title" className="portfolio-edit-account-card__title">
          Edit account
        </h2>
        <form onSubmit={saveAccount} className="portfolio-edit-account-form">
          <div className="portfolio-edit-field">
            <label className="portfolio-edit-field__label" htmlFor="acct-display-name">
              Account name
            </label>
            <input
              id="acct-display-name"
              className="crud-input portfolio-edit-account-card__input"
              value={acctName}
              onChange={(e) => setAcctName(e.target.value)}
              required
              autoComplete="off"
            />
          </div>

          <div className="portfolio-edit-field">
            <label className="portfolio-edit-field__label" htmlFor="acct-ext-ref">
              Account ref
            </label>
            <input
              id="acct-ext-ref"
              className="crud-input portfolio-edit-account-card__input"
              value={extRef}
              onChange={(e) => setExtRef(e.target.value)}
              required
              autoComplete="off"
            />
            <p className="portfolio-edit-field__hint">
              Match your broker account ID. Bulk CSV import for this book is handled in admin Hub, not here.
            </p>
          </div>

          <div className="portfolio-edit-field">
            <span className="portfolio-edit-field__label" id="acct-broker-type-label">
              Broker type
            </span>
            <select
              className="crud-input portfolio-edit-account-card__input portfolio-edit-disabled"
              disabled
              value={account.type}
              aria-labelledby="acct-broker-type-label"
              aria-readonly
            >
              <option value={account.type}>{formatBrokerType(account.type)}</option>
            </select>
            <p className="portfolio-edit-field__hint">Set when the account was created. Contact support to change.</p>
          </div>

          <div className="portfolio-edit-field">
            <label className="portfolio-edit-field__label" htmlFor="acct-cash">
              Initial balance
            </label>
            <div className="portfolio-edit-field__prefix portfolio-edit-account-card__input">
              <span>$</span>
              <input
                id="acct-cash"
                type="number"
                min={0}
                step="0.01"
                value={cashBalance}
                onChange={(e) => setCashBalance(e.target.value)}
                required
                aria-describedby="acct-cash-hint"
              />
            </div>
            <p id="acct-cash-hint" className="portfolio-edit-field__hint">
              Custodian cash for this account (book-level).
            </p>
          </div>

          <fieldset className="portfolio-edit-fieldset">
            <legend className="portfolio-edit-field__label">Risk level</legend>
            <div className="portfolio-risk-row portfolio-risk-row--legacy" role="group" aria-label="Risk level">
              {RISK_LEVEL_OPTIONS.map((opt) => (
                <button
                  key={opt.riskProfile}
                  type="button"
                  className={`portfolio-risk-btn${riskProfile === opt.riskProfile ? " portfolio-risk-btn--active" : ""}`}
                  onClick={() => setRiskProfile(opt.riskProfile)}
                >
                  <span
                    className="portfolio-risk-btn__dot"
                    style={{
                      background:
                        opt.tier === "low"
                          ? "color-mix(in srgb, var(--xf-success-400) 90%, var(--xf-gain-green))"
                          : opt.tier === "medium"
                            ? "color-mix(in srgb, var(--xf-lightning-yellow) 85%, var(--xf-text-100))"
                            : "color-mix(in srgb, var(--xf-danger-400) 85%, var(--xf-text-100))"
                    }}
                  />
                  {opt.label}
                </button>
              ))}
            </div>
            <div className="portfolio-edit-clear">
              <button
                type="button"
                className={`portfolio-edit-clear__btn${riskProfile === null ? " portfolio-edit-clear__btn--active" : ""}`}
                onClick={() => setRiskProfile(null)}
              >
                <XMarkIcon className="crud-icon" />
                Clear risk level
              </button>
            </div>
          </fieldset>

          <fieldset className="portfolio-edit-fieldset">
            <legend className="portfolio-edit-field__label">Market outlook</legend>
            <div className="portfolio-strategy-grid portfolio-strategy-grid--legacy" role="group" aria-label="Market outlook">
              {INVESTMENT_STRATEGY_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  className={`portfolio-strategy-card${outlook === opt.value ? " portfolio-strategy-card--active" : ""}`}
                  onClick={() => setOutlook(opt.value)}
                >
                  <p className="portfolio-strategy-card__title">{opt.title}</p>
                  <p className="portfolio-strategy-card__desc">{opt.description}</p>
                </button>
              ))}
            </div>
            <div className="portfolio-edit-clear">
              <button
                type="button"
                className={`portfolio-edit-clear__btn${outlook === null ? " portfolio-edit-clear__btn--active" : ""}`}
                onClick={() => setOutlook(null)}
              >
                <XMarkIcon className="crud-icon" />
                Clear outlook
              </button>
            </div>
          </fieldset>

          {account.isDefault ? (
            <p className="portfolio-edit-account-card__note">This is your default account for quick actions.</p>
          ) : null}

          <div className="portfolio-form-actions portfolio-form-actions--edit-account">
            <Link className="cta cta-secondary portfolio-form-actions__cancel" href="/portfolio">
              <XMarkIcon className="crud-icon" />
              Cancel
            </Link>
            <button type="submit" className="cta cta-primary portfolio-form-actions__submit" disabled={pending}>
              <SaveIcon className="crud-icon" />
              {pending ? "Saving…" : "Update account"}
            </button>
          </div>
        </form>
      </section>

      {portfolioAccountCount > 1 ? (
        <section
          className="portfolio-edit-account-card xf-noise-overlay"
          aria-labelledby="delete-account-title"
          style={{
            borderColor: "color-mix(in srgb, var(--xf-danger-400) 35%, transparent)"
          }}
        >
          <h2 id="delete-account-title" className="portfolio-edit-account-card__title">
            Remove account
          </h2>
          <p className="portfolio-edit-field__hint" style={{ marginTop: 0 }}>
            Deletes this account and its positions. You must keep at least one account in the workspace portfolio.
          </p>
          <button
            type="button"
            className="cta"
            style={{
              borderColor: "color-mix(in srgb, var(--xf-danger-400) 45%, transparent)",
              color: "var(--xf-danger-400)"
            }}
            disabled={deletePending}
            onClick={() => {
              if (
                !window.confirm(
                  `Delete account "${account.name}"? This removes its positions and cannot be undone.`
                )
              ) {
                return;
              }
              setDeletePending(true);
              setError(null);
              void (async () => {
                try {
                  const res = await fetch(
                    `/api/portfolios/${encodeURIComponent(portfolioId)}/accounts/${encodeURIComponent(account._id)}`,
                    { method: "DELETE", credentials: "include" }
                  );
                  const body = (await res.json().catch(() => ({}))) as { error?: string };
                  if (!res.ok) {
                    setError(body.error ?? "Could not delete account.");
                    return;
                  }
                  router.push("/portfolio");
                  router.refresh();
                } catch (e) {
                  setError(e instanceof Error ? e.message : "Delete failed.");
                } finally {
                  setDeletePending(false);
                }
              })();
            }}
          >
            <DeleteIcon className="crud-icon" aria-hidden />
            {deletePending ? "Deleting…" : "Delete this account"}
          </button>
        </section>
      ) : null}

      <section className="portfolio-edit-holdings-card xf-noise-overlay" aria-labelledby="edit-holdings-title">
        <h2 id="edit-holdings-title" className="portfolio-edit-account-card__title portfolio-edit-account-card__title--section">
          Holdings
        </h2>
        <h3 className="portfolio-edit-holdings-card__table-title">Current holdings table</h3>
        <p className="portfolio-edit-holdings-card__table-hint">
          Review and edit this account&apos;s positions directly from the table before adding new entries.
        </p>
        {positions.length === 0 ? (
          <p className="portfolio-edit-holdings-card__empty">No positions yet — add stock, options, or cash below.</p>
        ) : (
          <div className="portfolio-edit-holdings-card__table-wrap">
            <AccountHoldingsLiveTable pending={pending} positions={positions} onRemove={removePosition} />
          </div>
        )}

        <div className="portfolio-edit-holdings-card__divider" aria-hidden />
        <h3 className="portfolio-edit-holdings-card__subtitle">Add or update position</h3>
        <form onSubmit={addHolding} className="stack-gap portfolio-edit-holdings-form">
          <label className="portfolio-edit-holdings-field">
            <span className="portfolio-edit-holdings-field__label">Instrument type</span>
            <select
              className="crud-input portfolio-edit-account-card__input"
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
              <div
                className="stack-gap"
                style={{
                  gridColumn: "1 / -1",
                  maxWidth: "28rem"
                }}
              >
                <StockSymbolLiveField
                  purchasePrice={stPx}
                  symbolInput={stSym}
                  onSuggestPurchasePrice={setStPx}
                />
              </div>
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
                <SaveIcon className="crud-icon" />
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
                <SaveIcon className="crud-icon" />
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
                <SaveIcon className="crud-icon" />
                Save
              </button>
            </div>
          ) : null}
        </form>
      </section>

      <div className="cta-row">
        <Link className="cta cta-secondary" href="/portfolio">
          <BackIcon className="crud-icon" />
          Back to portfolio
        </Link>
      </div>
    </div>
  );
}
