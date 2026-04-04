"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition, type FormEvent } from "react";

import { BackIcon, DeleteIcon, SaveIcon, XMarkIcon } from "@/app/admin/ui/crud-icons";
import { editAccountFormSchema } from "@/app/portfolio/lib/edit-account-schema";
import { ACCOUNT_TYPE_LABELS, ACCOUNT_TYPE_PICKER_ORDER } from "@/lib/broker-ui";
import { RISK_LEVEL_OPTIONS } from "@/modules/core-admin/portfolio-preference-labels";
import { accountTypeValues, type AccountOutlook, type AccountType } from "@/modules/core-admin/types";

import type { SerializableAccount } from "@/app/portfolio/accounts/serializable-account";

export type { SerializableAccount } from "@/app/portfolio/accounts/serializable-account";

type AccountWorkspaceProps = {
  portfolioId: string;
  portfolioName: string;
  account: SerializableAccount;
  /** Total accounts in the workspace portfolio (enables delete when there is more than one). */
  portfolioAccountCount: number;
};

function coerceAccountType(raw: string): AccountType {
  return (accountTypeValues as readonly string[]).includes(raw) ? (raw as AccountType) : "fidelity";
}

const OUTLOOK_OPTIONS: ReadonlyArray<{ value: AccountOutlook; label: string }> = [
  { value: "bullish", label: "Bullish" },
  { value: "neutral", label: "Neutral" },
  { value: "bearish", label: "Bearish" }
];

function brokerPickerOptions(current: AccountType): AccountType[] {
  const base = [...ACCOUNT_TYPE_PICKER_ORDER];
  if (current === "etrade") {
    base.push("etrade");
  }
  return base;
}

export function AccountWorkspace({
  portfolioId,
  portfolioName,
  account,
  portfolioAccountCount
}: AccountWorkspaceProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [savePending, setSavePending] = useState(false);
  const [deletePending, setDeletePending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [acctName, setAcctName] = useState(account.name);
  const [cashBalance, setCashBalance] = useState(String(account.cashBalance));
  const [extRef, setExtRef] = useState(account.extAccountId);
  const [riskProfile, setRiskProfile] = useState<NonNullable<SerializableAccount["riskProfile"]>>(
    account.riskProfile ?? "balanced"
  );
  const [outlook, setOutlook] = useState<AccountOutlook>(account.outlook ?? "neutral");
  const [brokerType, setBrokerType] = useState<AccountType>(() => coerceAccountType(account.type));

  useEffect(() => {
    setAcctName(account.name);
    setCashBalance(String(account.cashBalance));
    setExtRef(account.extAccountId);
    setRiskProfile(account.riskProfile ?? "balanced");
    setOutlook(account.outlook ?? "neutral");
    setBrokerType(coerceAccountType(account.type));
  }, [
    account.name,
    account.cashBalance,
    account.extAccountId,
    account.riskProfile,
    account.outlook,
    account.type
  ]);

  const refLocked = account.brokerImportLocked;

  async function saveAccount(e: FormEvent) {
    e.preventDefault();
    setError(null);
    const cash = Number(cashBalance);
    const parsed = editAccountFormSchema.safeParse({
      name: acctName,
      extAccountId: extRef,
      type: brokerType,
      cashBalance: cash,
      outlook,
      riskProfile
    });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Check the form and try again.");
      return;
    }

    setSavePending(true);
    try {
      const body: Record<string, unknown> = {
        name: parsed.data.name,
        cashBalance: parsed.data.cashBalance,
        riskProfile: parsed.data.riskProfile,
        outlook: parsed.data.outlook
      };
      if (!refLocked) {
        body.extAccountId = parsed.data.extAccountId;
        body.type = parsed.data.type;
      }
      const res = await fetch(
        `/api/portfolios/${encodeURIComponent(portfolioId)}/accounts/${encodeURIComponent(account._id)}`,
        {
          method: "PATCH",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body)
        }
      );
      const resBody = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setError(resBody.error ?? "Could not update account");
        return;
      }
      startTransition(() => router.refresh());
    } finally {
      setSavePending(false);
    }
  }

  return (
    <div className="portfolio-workspace">
      <header className="portfolio-hero portfolio-hero--account-edit xf-noise-overlay">
        <p className="portfolio-hero__eyebrow portfolio-hero__eyebrow--account-edit-trail" aria-label="Breadcrumb">
          <Link className="portfolio-breadcrumb-link" href="/portfolio">
            PORTFOLIO
          </Link>
          <span className="portfolio-hero__crumb-sep" aria-hidden>
            {" "}
            →{" "}
          </span>
          <span className="portfolio-hero__crumb-portfolio-name">{portfolioName}</span>
          <span className="portfolio-hero__crumb-sep" aria-hidden>
            {" "}
            →{" "}
          </span>
          <span className="portfolio-hero__crumb-current">Edit Account</span>
        </p>
      </header>

      {error ? (
        <p className="status-text status-error" role="alert">
          {error}
        </p>
      ) : null}

      <section className="portfolio-edit-account-card xf-noise-overlay" aria-labelledby="edit-account-card-title">
        <h2 id="edit-account-card-title" className="portfolio-edit-account-card__title portfolio-edit-account-card__title--section">
          Account
        </h2>
        <form onSubmit={saveAccount} className="portfolio-edit-account-form" noValidate>
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
              maxLength={80}
              autoComplete="off"
              aria-describedby="acct-name-hint"
            />
            <p id="acct-name-hint" className="portfolio-edit-field__hint">
              Required — 1–80 characters.
            </p>
          </div>

          <div className="portfolio-edit-field">
            <label className="portfolio-edit-field__label" htmlFor="acct-ext-ref">
              Account ref
            </label>
            <input
              id="acct-ext-ref"
              className="crud-input portfolio-edit-account-card__input font-mono text-xs"
              value={extRef}
              onChange={(e) => setExtRef(e.target.value)}
              readOnly={refLocked}
              disabled={refLocked}
              required={!refLocked}
              autoComplete="off"
              aria-readonly={refLocked}
            />
            <p className="portfolio-edit-field__hint">
              {refLocked
                ? "Broker import is linked to this ref — it cannot be changed here."
                : "Broker-specific identifier (set before your first CSV import)."}
            </p>
          </div>

          <div className="portfolio-edit-field">
            <label className="portfolio-edit-field__label" htmlFor="acct-broker-type">
              Broker
            </label>
            <select
              id="acct-broker-type"
              className="crud-input portfolio-edit-account-card__input"
              value={brokerType}
              onChange={(e) => setBrokerType(e.target.value as AccountType)}
              disabled={refLocked}
              aria-label="Broker custodian"
            >
              {brokerPickerOptions(brokerType).map((t) => (
                <option key={t} value={t}>
                  {ACCOUNT_TYPE_LABELS[t]}
                </option>
              ))}
            </select>
            <p className="portfolio-edit-field__hint">
              {refLocked
                ? "Locked after broker import (CSV labeling)."
                : "Drives CSV import labeling. Choose before import."}
            </p>
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
              USD only, book-level cash. Used for CSV import layout and tax-lot tracking.
            </p>
          </div>

          <div className="portfolio-edit-account-section-divider" role="presentation" />

          <h3 className="portfolio-edit-account-card__title portfolio-edit-account-card__title--section">
            Outlook &amp; risk
          </h3>
          <p className="portfolio-edit-field__hint" style={{ marginTop: 0 }}>
            Account-level overrides used by xStrategyBuilder prefill, options-income scanner filters, and desk risk alerts.
          </p>

          <fieldset className="portfolio-edit-fieldset portfolio-edit-fieldset--segmented">
            <legend className="portfolio-edit-field__label">Market outlook</legend>
            <div className="portfolio-edit-segmented-row" role="radiogroup" aria-label="Market outlook">
              {OUTLOOK_OPTIONS.map((opt) => (
                <label
                  key={opt.value}
                  className={`portfolio-edit-segment${outlook === opt.value ? " portfolio-edit-segment--active" : ""}`}
                >
                  <input
                    type="radio"
                    name="account-outlook"
                    value={opt.value}
                    checked={outlook === opt.value}
                    onChange={() => setOutlook(opt.value)}
                    className="sr-only"
                  />
                  <span>{opt.label}</span>
                </label>
              ))}
            </div>
          </fieldset>

          <fieldset className="portfolio-edit-fieldset portfolio-edit-fieldset--segmented">
            <legend className="portfolio-edit-field__label">Risk level</legend>
            <div className="portfolio-edit-segmented-row" role="radiogroup" aria-label="Risk level">
              {RISK_LEVEL_OPTIONS.map((opt) => (
                <label
                  key={opt.riskProfile}
                  className={`portfolio-edit-segment${
                    riskProfile === opt.riskProfile ? " portfolio-edit-segment--active" : ""
                  }`}
                >
                  <input
                    type="radio"
                    name="account-risk"
                    value={opt.riskProfile}
                    checked={riskProfile === opt.riskProfile}
                    onChange={() => setRiskProfile(opt.riskProfile)}
                    className="sr-only"
                  />
                  <span>{opt.label}</span>
                </label>
              ))}
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
            <button type="submit" className="cta cta-primary portfolio-form-actions__submit" disabled={pending || savePending}>
              <SaveIcon className="crud-icon" />
              {savePending || pending ? "Saving…" : "Update account"}
            </button>
          </div>
        </form>
      </section>

      <section
        className="portfolio-edit-account-card portfolio-edit-account-card--danger-zone xf-noise-overlay"
        aria-labelledby="delete-account-title"
      >
        <h2 id="delete-account-title" className="portfolio-edit-account-card__title">
          Remove account
        </h2>
        <p className="portfolio-edit-field__hint" style={{ marginTop: 0 }}>
          Deletes this account and its positions. You must keep at least one account in the workspace portfolio.
        </p>
        <button
          type="button"
          className="portfolio-account-delete-btn"
          disabled={deletePending || portfolioAccountCount <= 1}
          onClick={() => {
            if (
              portfolioAccountCount <= 1 ||
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
              } catch (err) {
                setError(err instanceof Error ? err.message : "Delete failed.");
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

      <div className="cta-row">
        <Link className="cta cta-secondary" href="/portfolio">
          <BackIcon className="crud-icon" />
          ← Back to portfolio
        </Link>
      </div>
    </div>
  );
}
