"use client";

import { useMemo, useState, type FormEvent } from "react";

import { AddIcon } from "@/app/admin/ui/crud-icons";
import {
    REAL_ESTATE_HOLDING_DISCLAIMER,
    REAL_ESTATE_PROPERTY_TYPE_LABELS,
    computeFormNetEquityPreview,
    defaultRealEstateHoldingFormValues,
    formatUsdWhole,
    redfinEstimateSearchUrl,
    validateRealEstateHoldingForm,
    zillowEstimateSearchUrl,
    type RealEstateHoldingFormValues
} from "@/lib/real-estate-holding-form";
import {
    realEstatePropertyTypeValues,
    type RealEstateValuationSource
} from "@/modules/core-admin/types";

type RealEstateHoldingFormProps = {
  portfolioId: string;
  accountId: string;
  disabled?: boolean;
  submitLabel?: string;
  onSuccess?: () => void;
  onError?: (message: string) => void;
};

export function RealEstateHoldingForm({
  portfolioId,
  accountId,
  disabled = false,
  submitLabel = "Add alternative holding",
  onSuccess,
  onError
}: RealEstateHoldingFormProps) {
  const [values, setValues] = useState<RealEstateHoldingFormValues>(defaultRealEstateHoldingFormValues);
  const [pending, setPending] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  const netEquityPreview = useMemo(() => computeFormNetEquityPreview(values), [values]);
  const addressReady = values.address.trim().length >= 8;

  function patch<K extends keyof RealEstateHoldingFormValues>(key: K, value: RealEstateHoldingFormValues[K]) {
    setValues((prev) => ({ ...prev, [key]: value }));
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    setLocalError(null);
    const validated = validateRealEstateHoldingForm(values, portfolioId, accountId);
    if (!validated.ok) {
      setLocalError(validated.error);
      onError?.(validated.error);
      return;
    }
    setPending(true);
    try {
      const response = await fetch("/api/positions", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(validated.payload)
      });
      const body = (await response.json().catch(() => ({}))) as { error?: string };
      if (!response.ok) {
        const msg = body.error ?? "Could not save property.";
        setLocalError(msg);
        onError?.(msg);
        return;
      }
      setValues(defaultRealEstateHoldingFormValues());
      onSuccess?.();
    } catch {
      const msg = "Network error while saving property.";
      setLocalError(msg);
      onError?.(msg);
    } finally {
      setPending(false);
    }
  }

  return (
    <form className="portfolio-re-holding-form" onSubmit={submit}>
      <p className="portfolio-re-holding-form__disclaimer" role="note">
        {REAL_ESTATE_HOLDING_DISCLAIMER}
      </p>

      {localError ? (
        <p className="status-text status-error" role="alert">
          {localError}
        </p>
      ) : null}

      <div className="portfolio-re-holding-form__grid">
        <label className="portfolio-re-holding-form__field portfolio-re-holding-form__field--full">
          <span className="portfolio-re-holding-form__label">Holding name *</span>
          <input
            className="crud-input"
            value={values.holdingName}
            onChange={(e) => patch("holdingName", e.target.value)}
            placeholder="Lake Travis Waterfront — Primary Residence"
            required
            disabled={pending || disabled}
          />
        </label>

        <label className="portfolio-re-holding-form__field portfolio-re-holding-form__field--full">
          <span className="portfolio-re-holding-form__label">Full address</span>
          <input
            className="crud-input"
            value={values.address}
            onChange={(e) => patch("address", e.target.value)}
            placeholder="123 Lakeview Dr, Austin, TX 78734"
            autoComplete="street-address"
            disabled={pending || disabled}
          />
          <span className="portfolio-re-holding-form__hint">Used for public estimate lookups and desk context.</span>
        </label>

        <label className="portfolio-re-holding-form__field">
          <span className="portfolio-re-holding-form__label">Property type</span>
          <select
            className="crud-input"
            value={values.propertyType}
            onChange={(e) => patch("propertyType", e.target.value as RealEstateHoldingFormValues["propertyType"])}
            disabled={pending || disabled}
          >
            {realEstatePropertyTypeValues.map((pt) => (
              <option key={pt} value={pt}>
                {REAL_ESTATE_PROPERTY_TYPE_LABELS[pt]}
              </option>
            ))}
          </select>
        </label>

        {values.propertyType === "other" ? (
          <label className="portfolio-re-holding-form__field">
            <span className="portfolio-re-holding-form__label">Other type *</span>
            <input
              className="crud-input"
              value={values.propertyTypeOther}
              onChange={(e) => patch("propertyTypeOther", e.target.value)}
              placeholder="e.g. Vineyard estate"
              disabled={pending || disabled}
            />
          </label>
        ) : null}

        <label className="portfolio-re-holding-form__field">
          <span className="portfolio-re-holding-form__label">Current estimated value (USD) *</span>
          <input
            className="crud-input"
            type="text"
            inputMode="decimal"
            value={values.currentValueUsd}
            onChange={(e) => patch("currentValueUsd", e.target.value)}
            placeholder="2,850,000"
            required
            disabled={pending || disabled}
          />
        </label>

        <label className="portfolio-re-holding-form__field">
          <span className="portfolio-re-holding-form__label">Valuation date *</span>
          <input
            className="crud-input"
            type="date"
            value={values.valuationDate}
            onChange={(e) => patch("valuationDate", e.target.value)}
            required
            disabled={pending || disabled}
          />
        </label>

        <label className="portfolio-re-holding-form__field">
          <span className="portfolio-re-holding-form__label">Ownership %</span>
          <input
            className="crud-input"
            type="number"
            min={0}
            max={100}
            step="0.01"
            value={values.ownershipPct}
            onChange={(e) => patch("ownershipPct", e.target.value)}
            disabled={pending || disabled}
          />
        </label>

        <label className="portfolio-re-holding-form__field">
          <span className="portfolio-re-holding-form__label">Outstanding mortgage (USD)</span>
          <input
            className="crud-input"
            type="text"
            inputMode="decimal"
            value={values.mortgageBalanceUsd}
            onChange={(e) => patch("mortgageBalanceUsd", e.target.value)}
            placeholder="920,000"
            disabled={pending || disabled}
          />
        </label>

        <label className="portfolio-re-holding-form__field">
          <span className="portfolio-re-holding-form__label">Valuation source</span>
          <select
            className="crud-input"
            value={values.valuationSource}
            onChange={(e) => patch("valuationSource", e.target.value as RealEstateValuationSource)}
            disabled={pending || disabled}
          >
            <option value="user_provided">Manual / user-provided</option>
            <option value="zestimate_user_verified">Zestimate (user-verified paste)</option>
            <option value="housecanary_avm">HouseCanary AVM</option>
            <option value="appraiser">Professional appraisal</option>
          </select>
        </label>

        <label className="portfolio-re-holding-form__field portfolio-re-holding-form__field--full">
          <span className="portfolio-re-holding-form__label">Notes / tags</span>
          <textarea
            className="crud-input text-sm"
            rows={2}
            value={values.notes}
            onChange={(e) => patch("notes", e.target.value)}
            placeholder="3.25% 30-yr, refinanced 2023 · illiquid · family trust"
            disabled={pending || disabled}
          />
        </label>
      </div>

      {netEquityPreview != null ? (
        <p className="portfolio-re-holding-form__net">
          Net equity (desk mark): <strong className="font-mono tabular-nums">{formatUsdWhole(netEquityPreview)}</strong>
        </p>
      ) : null}

      <div className="portfolio-re-holding-form__lookup">
        <p className="portfolio-re-holding-form__lookup-title">Search public estimates (optional)</p>
        <p className="portfolio-re-holding-form__hint">
          Opens Zillow or Redfin in a new tab with your address. Copy the estimate you trust, paste it above, then set
          valuation source to <strong>Zestimate (user-verified paste)</strong>.
        </p>
        <div className="portfolio-re-holding-form__lookup-actions">
          <a
            className="cta cta-secondary"
            href={zillowEstimateSearchUrl(values.address)}
            target="_blank"
            rel="noopener noreferrer"
            aria-disabled={!addressReady}
            onClick={(e) => {
              if (!addressReady) {
                e.preventDefault();
              }
            }}
          >
            Search on Zillow
          </a>
          <a
            className="cta cta-secondary"
            href={redfinEstimateSearchUrl(values.address)}
            target="_blank"
            rel="noopener noreferrer"
            aria-disabled={!addressReady}
            onClick={(e) => {
              if (!addressReady) {
                e.preventDefault();
              }
            }}
          >
            Search on Redfin
          </a>
          <button
            type="button"
            className="cta cta-secondary"
            disabled={pending || disabled}
            onClick={() => patch("valuationSource", "zestimate_user_verified")}
          >
            Mark as Zestimate (user-verified)
          </button>
        </div>
        {!addressReady ? (
          <p className="portfolio-re-holding-form__hint">Enter a full address (8+ characters) to enable lookup links.</p>
        ) : null}
      </div>

      <button type="submit" className="cta cta-primary portfolio-re-holding-form__submit" disabled={pending || disabled}>
        <AddIcon className="crud-icon" />
        {pending ? "Saving…" : submitLabel}
      </button>
    </form>
  );
}
