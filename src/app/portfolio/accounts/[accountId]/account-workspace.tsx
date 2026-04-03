"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition, type FormEvent } from "react";

import {
    BackIcon,
    DeleteIcon,
    EditIcon,
    ListRowsIcon,
    SaveIcon,
    XMarkIcon
} from "@/app/admin/ui/crud-icons";
import { AccountHoldingsCrudCard } from "@/app/portfolio/ui/account-holdings-crud-card";
import { OutlookIconFor, outlookIconClassForSlug } from "@/app/ui/outlook-icons";
import { ACCOUNT_TYPE_LABELS } from "@/lib/broker-ui";
import { DESK_OUTLOOK_CARD_OPTIONS } from "@/modules/core-admin/desk-fields";
import { RISK_LEVEL_OPTIONS } from "@/modules/core-admin/portfolio-preference-labels";
import { accountTypeValues, type AccountOutlook, type AccountType } from "@/modules/core-admin/types";

import type { SerializableAccount, SerializablePosition } from "@/app/portfolio/accounts/serializable-account";

export type { SerializableAccount, SerializablePosition } from "@/app/portfolio/accounts/serializable-account";

type AccountWorkspaceProps = {
  portfolioId: string;
  account: SerializableAccount;
  initialPositions: SerializablePosition[];
  /** Total accounts in the workspace portfolio (enables delete when there is more than one). */
  portfolioAccountCount: number;
};

function coerceAccountType(raw: string): AccountType {
  return (accountTypeValues as readonly string[]).includes(raw) ? (raw as AccountType) : "fidelity";
}

/** Short preview for collapsed desk summary (outlook first, then risk). */
function deskFieldsSummaryPreview(
  outlook: AccountOutlook | null,
  riskProfile: SerializableAccount["riskProfile"]
): string {
  const parts: string[] = [];
  if (outlook) {
    const opt = DESK_OUTLOOK_CARD_OPTIONS.find((o) => o.value === outlook);
    const short = opt?.title.split(" / ")[0]?.trim();
    if (short) parts.push(short);
  }
  if (riskProfile) {
    const label = RISK_LEVEL_OPTIONS.find((o) => o.riskProfile === riskProfile)?.label;
    if (label) parts.push(label);
  }
  return parts.length > 0 ? parts.join(" · ") : "Not set";
}

export function AccountWorkspace({
  portfolioId,
  account,
  initialPositions,
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
  const [riskProfile, setRiskProfile] = useState<SerializableAccount["riskProfile"]>(account.riskProfile);
  const [outlook, setOutlook] = useState<AccountOutlook | null>(account.outlook);
  const [brokerType, setBrokerType] = useState<AccountType>(() => coerceAccountType(account.type));

  const [workspaceTab, setWorkspaceTab] = useState<"edit" | "holdings">("edit");

  useEffect(() => {
    setAcctName(account.name);
    setCashBalance(String(account.cashBalance));
    setExtRef(account.extAccountId);
    setRiskProfile(account.riskProfile);
    setOutlook(account.outlook);
    setBrokerType(coerceAccountType(account.type));
  }, [account.name, account.cashBalance, account.extAccountId, account.riskProfile, account.outlook, account.type]);

  async function saveAccount(e: FormEvent) {
    e.preventDefault();
    setError(null);
    const cash = Number(cashBalance);
    if (!Number.isFinite(cash) || cash < 0) {
      setError("Cash balance must be a non-negative number.");
      return;
    }
    const nameTrim = acctName.trim();
    if (!nameTrim) {
      setError("Account name is required.");
      return;
    }
    const extTrim = extRef.trim();
    if (!extTrim) {
      setError("Account ref is required.");
      return;
    }
    setSavePending(true);
    try {
      const res = await fetch(
        `/api/portfolios/${encodeURIComponent(portfolioId)}/accounts/${encodeURIComponent(account._id)}`,
        {
          method: "PATCH",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: nameTrim,
            cashBalance: cash,
            extAccountId: extTrim,
            type: brokerType,
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
    } finally {
      setSavePending(false);
    }
  }

  return (
    <div className="portfolio-workspace">
      {error ? (
        <p className="status-text status-error" role="alert">
          {error}
        </p>
      ) : null}

      <nav className="portfolio-manage-tabs" role="tablist" aria-label="Account workspace">
        <button
          type="button"
          role="tab"
          id="account-tab-edit"
          aria-selected={workspaceTab === "edit"}
          aria-controls="account-panel-edit"
          className={`portfolio-manage-tabs__btn${workspaceTab === "edit" ? " portfolio-manage-tabs__btn--active" : ""}`}
          onClick={() => setWorkspaceTab("edit")}
        >
          <EditIcon className="crud-icon" aria-hidden />
          Edit account
        </button>
        <button
          type="button"
          role="tab"
          id="account-tab-holdings"
          aria-selected={workspaceTab === "holdings"}
          aria-controls="account-panel-holdings"
          className={`portfolio-manage-tabs__btn${workspaceTab === "holdings" ? " portfolio-manage-tabs__btn--active" : ""}`}
          onClick={() => setWorkspaceTab("holdings")}
        >
          <ListRowsIcon className="crud-icon" aria-hidden />
          Holdings
        </button>
      </nav>

      {workspaceTab === "edit" ? (
      <div
        className="portfolio-manage-tabs__panel"
        role="tabpanel"
        id="account-panel-edit"
        aria-labelledby="account-tab-edit"
      >
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
            <label className="portfolio-edit-field__label" htmlFor="acct-broker-type">
              Broker
            </label>
            <select
              id="acct-broker-type"
              className="crud-input portfolio-edit-account-card__input"
              value={brokerType}
              onChange={(e) => setBrokerType(e.target.value as AccountType)}
              aria-label="Broker custodian"
            >
              {accountTypeValues.map((t) => (
                <option key={t} value={t}>
                  {ACCOUNT_TYPE_LABELS[t]}
                </option>
              ))}
            </select>
            <p className="portfolio-edit-field__hint">
              Used for CSV import layout hints and labeling. Update account ref if you switch custodians.
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
              Custodian cash for this account (book-level).
            </p>
          </div>

          <details className="portfolio-disclosure portfolio-edit-desk-disclosure">
            <summary className="portfolio-disclosure__summary portfolio-edit-desk-disclosure__summary">
              <span className="portfolio-edit-desk-disclosure__summary-main">
                <span className="portfolio-edit-desk-disclosure__chevron" aria-hidden>
                  ▸
                </span>
                Outlook &amp; risk
              </span>
              <span className="portfolio-edit-desk-disclosure__preview" title={deskFieldsSummaryPreview(outlook, riskProfile)}>
                {deskFieldsSummaryPreview(outlook, riskProfile)}
              </span>
            </summary>
            <div className="portfolio-disclosure__body portfolio-edit-desk-disclosure__body">
              <fieldset className="portfolio-edit-fieldset portfolio-edit-desk-disclosure__fieldset">
                <legend className="portfolio-edit-field__label">Market outlook</legend>
                <div
                  className="portfolio-strategy-grid portfolio-strategy-grid--legacy portfolio-strategy-grid--desk-compact"
                  role="group"
                  aria-label="Market outlook"
                >
                  {DESK_OUTLOOK_CARD_OPTIONS.map((opt) => (
                    <button
                      key={opt.value}
                      type="button"
                      className={`portfolio-strategy-card portfolio-strategy-card--desk-compact${
                        outlook === opt.value ? " portfolio-strategy-card--active" : ""
                      }`}
                      aria-label={`${opt.title}. ${opt.description}`}
                      onClick={() => setOutlook(opt.value)}
                    >
                      <div className="portfolio-strategy-card__head">
                        <span className={`portfolio-strategy-card__icon ${outlookIconClassForSlug(opt.value)}`}>
                          <OutlookIconFor className="h-3.5 w-3.5" outlook={opt.value} />
                        </span>
                        <span className="min-w-0 flex-1">
                          <p className="portfolio-strategy-card__title portfolio-strategy-card__title--desk-compact">
                            {opt.title.split(" / ")[0]}
                          </p>
                          <span className="portfolio-strategy-card__desc portfolio-strategy-card__desc--desk-compact">
                            {opt.description}
                          </span>
                        </span>
                      </div>
                    </button>
                  ))}
                </div>
                <div className="portfolio-edit-clear portfolio-edit-clear--desk-compact">
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

              <fieldset className="portfolio-edit-fieldset portfolio-edit-desk-disclosure__fieldset">
                <legend className="portfolio-edit-field__label">Risk level</legend>
                <div
                  className="portfolio-risk-row portfolio-risk-row--legacy portfolio-risk-row--desk-compact"
                  role="group"
                  aria-label="Risk level"
                >
                  {RISK_LEVEL_OPTIONS.map((opt) => (
                    <button
                      key={opt.riskProfile}
                      type="button"
                      className={`portfolio-risk-btn portfolio-risk-btn--desk-compact${
                        riskProfile === opt.riskProfile ? " portfolio-risk-btn--active" : ""
                      }`}
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
                <div className="portfolio-edit-clear portfolio-edit-clear--desk-compact">
                  <button
                    type="button"
                    className={`portfolio-edit-clear__btn${riskProfile === null ? " portfolio-edit-clear__btn--active" : ""}`}
                    onClick={() => setRiskProfile(null)}
                  >
                    <XMarkIcon className="crud-icon" />
                    Clear risk
                  </button>
                </div>
              </fieldset>
            </div>
          </details>

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

      {portfolioAccountCount > 1 ? (
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
      </div>
      ) : null}

      {workspaceTab === "holdings" ? (
      <div
        className="portfolio-manage-tabs__panel"
        role="tabpanel"
        id="account-panel-holdings"
        aria-labelledby="account-tab-holdings"
      >
      <AccountHoldingsCrudCard
        accountIdHex={account._id}
        initialPositions={initialPositions}
        portfolioIdHex={portfolioId}
      />
      </div>
      ) : null}

      <div className="cta-row">
        <Link className="cta cta-secondary" href="/portfolio">
          <BackIcon className="crud-icon" />
          Back to portfolio
        </Link>
      </div>
    </div>
  );
}
