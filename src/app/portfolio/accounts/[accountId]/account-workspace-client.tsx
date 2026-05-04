"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState, useTransition, type FormEvent, type ReactNode } from "react";

import { BackIcon, DeleteIcon, EditIcon, ListRowsIcon, SaveIcon, XMarkIcon } from "@/app/admin/ui/crud-icons";
import {
    editAccountFormSchema,
    editAccountFormSchemaWithoutExtRef
} from "@/app/portfolio/lib/edit-account-schema";
import { ACCOUNT_TYPE_LABELS, ACCOUNT_TYPE_PICKER_ORDER } from "@/lib/broker-ui";
import {
    hnwiGuardrailsPartialSchema,
    type HnwiGuardrailsPatchPayload
} from "@/modules/core-admin/portfolio-account-hnwi-guardrails";
import { RISK_LEVEL_OPTIONS } from "@/modules/core-admin/portfolio-preference-labels";
import {
    accountTypeValues,
    type AccountOutlook,
    type AccountType,
    type PortfolioAccountMarginRule,
    type PortfolioAccountTaxLotMatching,
    type PortfolioAccountTaxTreatment
} from "@/modules/core-admin/types";

import type { SerializableAccount, SerializablePosition } from "@/app/portfolio/accounts/serializable-account";
import { AccountHoldingsCrudCard } from "@/app/portfolio/ui/account-holdings-crud-card";

export type { SerializableAccount } from "@/app/portfolio/accounts/serializable-account";

type AccountWorkspaceProps = {
  portfolioId: string;
  portfolioName: string;
  account: SerializableAccount;
  portfolioAccountCount: number;
  initialPositions: SerializablePosition[];
};

type EditTab = "account" | "holdings";

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

function fractionToPercentInput(f: number | null | undefined): string {
  if (f == null || !Number.isFinite(f)) {
    return "";
  }
  return String(Math.round(f * 10_000) / 100);
}

const HNWI_TAX_OPTIONS: ReadonlyArray<{ value: PortfolioAccountTaxTreatment; label: string }> = [
  { value: "taxable", label: "Taxable" },
  { value: "tax_advantaged", label: "Tax-advantaged (IRA, 401k, HSA, …)" }
];

const HNWI_MARGIN_OPTIONS: ReadonlyArray<{ value: PortfolioAccountMarginRule; label: string }> = [
  { value: "cash_only", label: "Cash only (no margin)" },
  { value: "limited_margin", label: "Limited margin" },
  { value: "full_margin", label: "Full margin" }
];

const HNWI_LOT_OPTIONS: ReadonlyArray<{ value: PortfolioAccountTaxLotMatching; label: string }> = [
  { value: "fifo", label: "FIFO" },
  { value: "lifo", label: "LIFO" },
  { value: "specific_identification", label: "Specific identification" },
  { value: "highest_cost", label: "Highest cost" }
];

function AccountWorkspaceTabFallback() {
  return (
    <div className="portfolio-workspace">
      <div
        className="portfolio-account-edit-tab-skeleton xf-noise-overlay"
        aria-hidden
      />
      <p className="status-text portfolio-account-edit-tab-skeleton__msg">Loading workspace…</p>
    </div>
  );
}

function AccountWorkspaceInner({
  portfolioId,
  portfolioName,
  account,
  portfolioAccountCount,
  initialPositions
}: AccountWorkspaceProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const tabParam = searchParams.get("tab");
  const activeTab: EditTab = tabParam === "holdings" ? "holdings" : "account";

  const [pending, startTransition] = useTransition();
  const [savePending, setSavePending] = useState(false);
  const [deletePending, setDeletePending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [acctName, setAcctName] = useState(account.name);
  const [cashBalance, setCashBalance] = useState(String(account.cashBalance));
  const [extRefDraft, setExtRefDraft] = useState("");
  const [refReplaceDraft, setRefReplaceDraft] = useState("");
  const [riskProfile, setRiskProfile] = useState<NonNullable<SerializableAccount["riskProfile"]>>(
    account.riskProfile ?? "balanced"
  );
  const [outlook, setOutlook] = useState<AccountOutlook>(account.outlook ?? "neutral");
  const [brokerType, setBrokerType] = useState<AccountType>(() => coerceAccountType(account.type));

  const g0 = account.hnwiGuardrails;
  const [hnwiTaxTreatment, setHnwiTaxTreatment] = useState<string>(g0?.taxTreatment ?? "");
  const [hnwiMaxPositionPct, setHnwiMaxPositionPct] = useState(() =>
    fractionToPercentInput(g0?.maxPositionPctOfEquity ?? null)
  );
  const [hnwiMarginRule, setHnwiMarginRule] = useState<string>(g0?.marginRule ?? "");
  const [hnwiTaxLots, setHnwiTaxLots] = useState<string>(g0?.taxLotMatching ?? "");
  const [hnwiMinLiqCashPct, setHnwiMinLiqCashPct] = useState(() =>
    fractionToPercentInput(g0?.minLiquidityCashPctOfEquity ?? null)
  );
  const [hnwiMinLiqMonths, setHnwiMinLiqMonths] = useState(
    g0?.minLiquidityMonthsExpenses != null && Number.isFinite(g0.minLiquidityMonthsExpenses)
      ? String(g0.minLiquidityMonthsExpenses)
      : ""
  );

  useEffect(() => {
    setAcctName(account.name);
    setCashBalance(String(account.cashBalance));
    setExtRefDraft("");
    setRefReplaceDraft("");
    setRiskProfile(account.riskProfile ?? "balanced");
    setOutlook(account.outlook ?? "neutral");
    setBrokerType(coerceAccountType(account.type));
    const g = account.hnwiGuardrails;
    setHnwiTaxTreatment(g?.taxTreatment ?? "");
    setHnwiMaxPositionPct(fractionToPercentInput(g?.maxPositionPctOfEquity ?? null));
    setHnwiMarginRule(g?.marginRule ?? "");
    setHnwiTaxLots(g?.taxLotMatching ?? "");
    setHnwiMinLiqCashPct(fractionToPercentInput(g?.minLiquidityCashPctOfEquity ?? null));
    setHnwiMinLiqMonths(
      g?.minLiquidityMonthsExpenses != null && Number.isFinite(g.minLiquidityMonthsExpenses)
        ? String(g.minLiquidityMonthsExpenses)
        : ""
    );
  }, [
    account._id,
    account.name,
    account.cashBalance,
    account.hasExtAccountRef,
    account.extAccountRefMasked,
    account.brokerImportLocked,
    account.riskProfile,
    account.outlook,
    account.type,
    account.hnwiGuardrails
  ]);

  function setTab(next: EditTab) {
    const qs = next === "holdings" ? "?tab=holdings" : "";
    router.replace(`${pathname}${qs}`, { scroll: false });
  }

  const brokerLocked = account.brokerImportLocked;
  const refSaved = account.hasExtAccountRef;
  const canEditRefAndBroker = !brokerLocked && !refSaved;

  function hnwiPatchForSave():
    | { ok: true; value: HnwiGuardrailsPatchPayload }
    | { ok: false; message: string } {
    const maxTrim = hnwiMaxPositionPct.trim();
    const cashTrim = hnwiMinLiqCashPct.trim();
    const monthsTrim = hnwiMinLiqMonths.trim();
    const patch: HnwiGuardrailsPatchPayload = {
      taxTreatment: hnwiTaxTreatment === "" ? null : (hnwiTaxTreatment as PortfolioAccountTaxTreatment),
      maxPositionPctOfEquity: maxTrim === "" ? null : Number(maxTrim) / 100,
      marginRule: hnwiMarginRule === "" ? null : (hnwiMarginRule as PortfolioAccountMarginRule),
      taxLotMatching: hnwiTaxLots === "" ? null : (hnwiTaxLots as PortfolioAccountTaxLotMatching),
      minLiquidityCashPctOfEquity: cashTrim === "" ? null : Number(cashTrim) / 100,
      minLiquidityMonthsExpenses: monthsTrim === "" ? null : Number(monthsTrim)
    };
    const parsed = hnwiGuardrailsPartialSchema.safeParse(patch);
    if (!parsed.success) {
      return {
        ok: false,
        message: parsed.error.issues[0]?.message ?? "Check HNWI guardrail fields."
      };
    }
    return { ok: true, value: parsed.data };
  }

  async function saveAccount(e: FormEvent) {
    e.preventDefault();
    setError(null);
    const hnwiParsed = hnwiPatchForSave();
    if (!hnwiParsed.ok) {
      setError(hnwiParsed.message);
      return;
    }
    const cash = Number(cashBalance);

    if (canEditRefAndBroker) {
      const parsed = editAccountFormSchema.safeParse({
        name: acctName,
        extAccountId: extRefDraft,
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
          outlook: parsed.data.outlook,
          extAccountId: parsed.data.extAccountId,
          type: parsed.data.type,
          hnwiGuardrails: hnwiParsed.value
        };
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
      return;
    }

    const parsed = editAccountFormSchemaWithoutExtRef.safeParse({
      name: acctName,
      type: brokerType,
      cashBalance: cash,
      outlook,
      riskProfile
    });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Check the form and try again.");
      return;
    }

    const replaceRef = refReplaceDraft.trim();
    if (replaceRef.length > 200) {
      setError("New account ref is too long (max 200 characters).");
      return;
    }

    setSavePending(true);
    try {
      const body: Record<string, unknown> = {
        name: parsed.data.name,
        cashBalance: parsed.data.cashBalance,
        riskProfile: parsed.data.riskProfile,
        outlook: parsed.data.outlook,
        hnwiGuardrails: hnwiParsed.value
      };
      if (!brokerLocked) {
        body.type = parsed.data.type;
      }
      if (replaceRef) {
        body.extAccountId = replaceRef;
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

  const accountPanel: ReactNode = (
    <>
      <section className="portfolio-edit-account-card xf-noise-overlay" aria-labelledby="edit-account-card-title">
        <h2 id="edit-account-card-title" className="portfolio-edit-account-card__title portfolio-edit-account-card__title--section">
          Account details
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
            <span className="portfolio-edit-field__label" id="acct-ext-ref-lbl">
              Account ref
            </span>
            {canEditRefAndBroker ? (
              <>
                <input
                  id="acct-ext-ref"
                  className="crud-input portfolio-edit-account-card__input font-mono text-xs"
                  value={extRefDraft}
                  onChange={(e) => setExtRefDraft(e.target.value)}
                  required
                  autoComplete="off"
                  aria-labelledby="acct-ext-ref-lbl"
                  aria-describedby="acct-ext-ref-hint"
                />
                <p id="acct-ext-ref-hint" className="portfolio-edit-field__hint">
                  Broker account identifier. Set once — after you save, only the last four digits are shown and the full
                  ref cannot be changed here.
                </p>
              </>
            ) : (
              <>
                <div
                  id="acct-ext-ref"
                  className="crud-input portfolio-edit-account-card__input font-mono text-xs portfolio-edit-account-card__xref-masked"
                  aria-labelledby="acct-ext-ref-lbl"
                  aria-describedby="acct-ext-ref-hint-locked"
                >
                  {account.extAccountRefMasked}
                </div>
                <p id="acct-ext-ref-hint-locked" className="portfolio-edit-field__hint">
                  {brokerLocked && refSaved
                    ? "CSV import is tied to this account. Broker type is locked below. Only the last characters of the ref are shown above for privacy."
                    : brokerLocked && !refSaved
                      ? "Broker type is locked after import. Set or correct the broker account id used for CSV matching."
                      : "Stored broker ref (last four shown above). Edit below to replace the full id."}
                </p>
                <label className="portfolio-edit-field__label mt-3" htmlFor="acct-ext-ref-replace">
                  Update account ref
                </label>
                <input
                  id="acct-ext-ref-replace"
                  className="crud-input portfolio-edit-account-card__input font-mono text-xs"
                  value={refReplaceDraft}
                  onChange={(e) => setRefReplaceDraft(e.target.value)}
                  autoComplete="off"
                  placeholder={refSaved ? "New broker account id (optional)" : "Broker account id"}
                  maxLength={200}
                  aria-describedby="acct-ext-ref-replace-hint"
                />
                <p id="acct-ext-ref-replace-hint" className="portfolio-edit-field__hint">
                  {refSaved
                    ? "Leave blank to keep the current ref. Enter text and click Update account to save a new id."
                    : "Enter your broker account identifier, then click Update account."}
                </p>
              </>
            )}
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
              disabled={brokerLocked}
              aria-label="Broker custodian"
            >
              {brokerPickerOptions(brokerType).map((t) => (
                <option key={t} value={t}>
                  {ACCOUNT_TYPE_LABELS[t]}
                </option>
              ))}
            </select>
            <p className="portfolio-edit-field__hint">
              {brokerLocked
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

          <div className="portfolio-edit-account-section-divider" role="presentation" />

          <h3 className="portfolio-edit-account-card__title portfolio-edit-account-card__title--section">
            HNWI guardrails (optional)
          </h3>
          <p className="portfolio-edit-field__hint" style={{ marginTop: 0 }}>
            Desk notes for this custody account only — not trade enforcement. Tax treatment, position-sizing band (often
            about 5–10% of equity per name), margin posture, tax-lot preference, and liquidity floors.
          </p>

          <div className="portfolio-edit-field">
            <label className="portfolio-edit-field__label" htmlFor="hnwi-tax">
              Tax posture
            </label>
            <select
              id="hnwi-tax"
              className="crud-input portfolio-edit-account-card__input"
              value={hnwiTaxTreatment}
              onChange={(e) => setHnwiTaxTreatment(e.target.value)}
              aria-describedby="hnwi-tax-hint"
            >
              <option value="">Not set</option>
              {HNWI_TAX_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
            <p id="hnwi-tax-hint" className="portfolio-edit-field__hint">
              Taxable vs tax-advantaged registry for this book.
            </p>
          </div>

          <div className="portfolio-edit-field">
            <label className="portfolio-edit-field__label" htmlFor="hnwi-max-pos">
              Max position (% of equity)
            </label>
            <input
              id="hnwi-max-pos"
              type="number"
              min={0.01}
              max={100}
              step="0.01"
              className="crud-input portfolio-edit-account-card__input"
              value={hnwiMaxPositionPct}
              onChange={(e) => setHnwiMaxPositionPct(e.target.value)}
              placeholder="e.g. 8 for 8%"
              aria-describedby="hnwi-max-pos-hint"
            />
            <p id="hnwi-max-pos-hint" className="portfolio-edit-field__hint">
              Conservative band is often 5–10%. Stored as a fraction server-side (1–100% here).
            </p>
          </div>

          <div className="portfolio-edit-field">
            <label className="portfolio-edit-field__label" htmlFor="hnwi-margin">
              Margin rule
            </label>
            <select
              id="hnwi-margin"
              className="crud-input portfolio-edit-account-card__input"
              value={hnwiMarginRule}
              onChange={(e) => setHnwiMarginRule(e.target.value)}
            >
              <option value="">Not set</option>
              {HNWI_MARGIN_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>

          <div className="portfolio-edit-field">
            <label className="portfolio-edit-field__label" htmlFor="hnwi-lots">
              Tax-lot matching
            </label>
            <select
              id="hnwi-lots"
              className="crud-input portfolio-edit-account-card__input"
              value={hnwiTaxLots}
              onChange={(e) => setHnwiTaxLots(e.target.value)}
              aria-describedby="hnwi-lots-hint"
            >
              <option value="">Not set</option>
              {HNWI_LOT_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
            <p id="hnwi-lots-hint" className="portfolio-edit-field__hint">
              Disposal preference for this account (informational).
            </p>
          </div>

          <div className="portfolio-edit-field">
            <label className="portfolio-edit-field__label" htmlFor="hnwi-liq-cash">
              Min liquidity — cash (% of equity)
            </label>
            <input
              id="hnwi-liq-cash"
              type="number"
              min={0}
              max={100}
              step="0.01"
              className="crud-input portfolio-edit-account-card__input"
              value={hnwiMinLiqCashPct}
              onChange={(e) => setHnwiMinLiqCashPct(e.target.value)}
              placeholder="e.g. 5"
              aria-describedby="hnwi-liq-cash-hint"
            />
            <p id="hnwi-liq-cash-hint" className="portfolio-edit-field__hint">
              Optional minimum cash / sweep as percent of equity.
            </p>
          </div>

          <div className="portfolio-edit-field">
            <label className="portfolio-edit-field__label" htmlFor="hnwi-liq-months">
              Min liquidity — months of expenses
            </label>
            <input
              id="hnwi-liq-months"
              type="number"
              min={0}
              max={600}
              step="1"
              className="crud-input portfolio-edit-account-card__input"
              value={hnwiMinLiqMonths}
              onChange={(e) => setHnwiMinLiqMonths(e.target.value)}
              placeholder="Optional"
              aria-describedby="hnwi-liq-months-hint"
            />
            <p id="hnwi-liq-months-hint" className="portfolio-edit-field__hint">
              Advisory liquidity runway note (whole months).
            </p>
          </div>

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
              !window.confirm(`Delete account "${account.name}"? This removes its positions and cannot be undone.`)
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
    </>
  );

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
          <span className="portfolio-hero__crumb-current">{account.name}</span>
        </p>
        <p className="portfolio-account-edit-hero-sub">Edit account</p>
      </header>

      {error ? (
        <p className="status-text status-error" role="alert">
          {error}
        </p>
      ) : null}

      <div className="portfolio-account-edit-tabs-wrap xf-noise-overlay">
        <nav className="portfolio-manage-tabs portfolio-account-edit-tabs" aria-label="Account workspace">
          <button
            type="button"
            id="account-edit-tab-account"
            role="tab"
            aria-selected={activeTab === "account"}
            aria-controls="account-edit-panel-account"
            className={`portfolio-manage-tabs__btn${activeTab === "account" ? " portfolio-manage-tabs__btn--active" : ""}`}
            onClick={() => setTab("account")}
          >
            <EditIcon className="crud-icon" aria-hidden />
            Account
          </button>
          <button
            type="button"
            id="account-edit-tab-holdings"
            role="tab"
            aria-selected={activeTab === "holdings"}
            aria-controls="account-edit-panel-holdings"
            className={`portfolio-manage-tabs__btn${activeTab === "holdings" ? " portfolio-manage-tabs__btn--active" : ""}`}
            onClick={() => setTab("holdings")}
          >
            <ListRowsIcon className="crud-icon" aria-hidden />
            Holdings
          </button>
        </nav>

        <div className="portfolio-manage-tabs__panel">
          <div
            id="account-edit-panel-account"
            role="tabpanel"
            aria-labelledby="account-edit-tab-account"
            hidden={activeTab !== "account"}
            className="portfolio-account-edit-tab-panel"
          >
            {accountPanel}
          </div>
          <div
            id="account-edit-panel-holdings"
            role="tabpanel"
            aria-labelledby="account-edit-tab-holdings"
            hidden={activeTab !== "holdings"}
            className="portfolio-account-edit-tab-panel"
          >
            <AccountHoldingsCrudCard
              accountIdHex={account._id}
              embeddedInTab
              initialPositions={initialPositions}
              portfolioIdHex={portfolioId}
            />
          </div>
        </div>
      </div>

      <div className="cta-row">
        <Link className="cta cta-secondary" href="/portfolio">
          <BackIcon className="crud-icon" />
          ← Back to portfolio
        </Link>
      </div>
    </div>
  );
}

export function AccountWorkspace(props: AccountWorkspaceProps) {
  return (
    <Suspense fallback={<AccountWorkspaceTabFallback />}>
      <AccountWorkspaceInner {...props} />
    </Suspense>
  );
}
