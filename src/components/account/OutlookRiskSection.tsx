"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import type { SerializableAccount } from "@/app/portfolio/accounts/serializable-account";
import { useInvestmentOutlookRefresh } from "@/hooks/useInvestmentOutlookRefresh";
import { RISK_LEVEL_OPTIONS } from "@/modules/core-admin/portfolio-preference-labels";
import type { AccountOutlook } from "@/modules/core-admin/types";

const OUTLOOK_OPTIONS: ReadonlyArray<{ value: AccountOutlook; label: string }> = [
  { value: "bullish", label: "Bullish" },
  { value: "neutral", label: "Neutral" },
  { value: "bearish", label: "Bearish" }
];

function guardrailDetailForRisk(risk: NonNullable<SerializableAccount["riskProfile"]>): string {
  if (risk === "conservative") {
    return "Max ~8% equity per position · Emphasize high-IV credit spreads and covered calls when liquidity allows.";
  }
  if (risk === "growth") {
    return "Max ~20% equity per position · Directional ideas plus defined-risk income when names are liquid.";
  }
  return "Max ~12% equity per position · Iron condors, credit spreads, and wheel-style income fit this band.";
}

export type OutlookRiskSectionProps = {
  portfolioId: string;
  accountId: string;
  investmentOutlookRefreshEnabled: boolean;
  outlook: AccountOutlook;
  riskProfile: NonNullable<SerializableAccount["riskProfile"]>;
  outlookRefreshEnabled: boolean;
  onOutlookChange: (next: AccountOutlook) => void;
  onRiskChange: (next: NonNullable<SerializableAccount["riskProfile"]>) => void;
  onOutlookRefreshEnabledChange: (next: boolean) => void;
  /** Snapshot after navigation refresh — last refresh / confidence / source */
  lastOutlookRefreshAt: string | null;
  outlookConfidence: number | null;
  outlookRefreshSource: string | null;
  disabled?: boolean;
  onErrorMessage: (message: string | null) => void;
};

export function OutlookRiskSection({
  portfolioId,
  accountId,
  investmentOutlookRefreshEnabled,
  outlook,
  riskProfile,
  outlookRefreshEnabled,
  onOutlookChange,
  onRiskChange,
  onOutlookRefreshEnabledChange,
  lastOutlookRefreshAt,
  outlookConfidence,
  outlookRefreshSource,
  disabled = false,
  onErrorMessage
}: OutlookRiskSectionProps) {
  const router = useRouter();
  const { refreshOutlook, refreshPending } = useInvestmentOutlookRefresh(accountId);
  const [toggleBusy, setToggleBusy] = useState(false);
  const [banner, setBanner] = useState<string | null>(null);
  const bannerTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (bannerTimerRef.current) {
        clearTimeout(bannerTimerRef.current);
      }
    };
  }, []);

  const busy = Boolean(disabled || toggleBusy || refreshPending);

  async function patchOutlookRefreshToggle(next: boolean): Promise<void> {
    setToggleBusy(true);
    onErrorMessage(null);
    const prev = outlookRefreshEnabled;
    onOutlookRefreshEnabledChange(next);
    try {
      const res = await fetch(
        `/api/portfolios/${encodeURIComponent(portfolioId)}/accounts/${encodeURIComponent(accountId)}`,
        {
          method: "PATCH",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ outlookRefreshEnabled: next })
        }
      );
      const body = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        onOutlookRefreshEnabledChange(prev);
        onErrorMessage(body.error ?? "Could not update outlook refresh preference");
        return;
      }
      router.refresh();
    } finally {
      setToggleBusy(false);
    }
  }

  async function handleRefreshNow(): Promise<void> {
    onErrorMessage(null);
    setBanner(null);
    const result = await refreshOutlook();
    if (!result.ok) {
      onErrorMessage(result.error);
      return;
    }
    const outlookLabel =
      result.marketOutlook === "bullish"
        ? "Bullish"
        : result.marketOutlook === "bearish"
          ? "Bearish"
          : "Neutral";
    const confPct =
      result.confidence != null && Number.isFinite(result.confidence)
        ? `${Math.round(result.confidence * 100)}%`
        : null;
    const msg = confPct
      ? `Outlook refresh recorded (${outlookLabel}, ${confPct} confidence). xChat uses this desk posture on the next message.`
      : `Outlook refresh recorded (${outlookLabel}). xChat uses this desk posture on the next message.`;
    setBanner(msg);
    if (bannerTimerRef.current) {
      clearTimeout(bannerTimerRef.current);
    }
    bannerTimerRef.current = setTimeout(() => setBanner(null), 12_000);
    router.refresh();
  }

  return (
    <section
      className="account-outlook-risk-section"
      aria-labelledby="account-outlook-risk-heading"
      style={{
        borderRadius: "var(--xf-radius-md, 0.5rem)",
        border: "1px solid color-mix(in srgb, var(--xf-text-100) 12%, transparent)",
        background: "var(--xf-surface-700)",
        padding: "1rem 1.125rem",
        display: "flex",
        flexDirection: "column",
        gap: "1rem"
      }}
    >
      <div>
        <h3
          id="account-outlook-risk-heading"
          className="portfolio-edit-account-card__title portfolio-edit-account-card__title--section"
          style={{ marginBottom: "0.35rem" }}
        >
          Outlook &amp; risk
        </h3>
        <p className="portfolio-edit-field__hint" style={{ marginTop: 0 }}>
          Single source of truth for this book — drives xChat context, xOptions posture hints, and xStrategyBuilder
          prefill. Saves with <strong>Update account</strong> below unless noted.
        </p>
      </div>

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
                name="account-outlook-section"
                value={opt.value}
                checked={outlook === opt.value}
                onChange={() => onOutlookChange(opt.value)}
                className="sr-only"
                disabled={busy}
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
                name="account-risk-section"
                value={opt.riskProfile}
                checked={riskProfile === opt.riskProfile}
                onChange={() => onRiskChange(opt.riskProfile)}
                className="sr-only"
                disabled={busy}
              />
              <span>{opt.label}</span>
            </label>
          ))}
        </div>
        <p
          className="portfolio-edit-field__hint"
          style={{ marginTop: "0.65rem" }}
          aria-live="polite"
          key={riskProfile}
        >
          {guardrailDetailForRisk(riskProfile)}
        </p>
      </fieldset>

      {investmentOutlookRefreshEnabled ? (
        <div
          style={{
            borderRadius: "var(--xf-radius-sm, 0.375rem)",
            border: "1px solid color-mix(in srgb, var(--xf-text-100) 10%, transparent)",
            background: "color-mix(in srgb, var(--xf-text-100) 4%, transparent)",
            padding: "0.875rem 1rem",
            display: "flex",
            flexDirection: "column",
            gap: "0.75rem"
          }}
        >
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              alignItems: "flex-start",
              justifyContent: "space-between",
              gap: "0.75rem"
            }}
          >
            <div style={{ flex: "1 1 12rem" }}>
              <p className="portfolio-edit-field__label" style={{ marginBottom: "0.25rem" }}>
                Auto-refresh outlook
              </p>
              <p className="portfolio-edit-field__hint" style={{ marginTop: 0 }}>
                When enabled, tenant pipelines may refresh Bullish / Neutral / Bearish using macro + sentiment (manual
                pills stay available).
              </p>
            </div>
            <label
              style={{ display: "flex", alignItems: "center", gap: "0.5rem", cursor: busy ? "default" : "pointer" }}
            >
              <input
                type="checkbox"
                checked={outlookRefreshEnabled}
                disabled={busy}
                onChange={(e) => void patchOutlookRefreshToggle(e.target.checked)}
                aria-label="Enable automatic outlook refresh for this account"
              />
              <span className="portfolio-edit-field__hint" style={{ margin: 0 }}>
                Enabled
              </span>
            </label>
          </div>

          <div className="portfolio-edit-field">
            <p className="portfolio-edit-field__label">Last outlook refresh</p>
            <p className="portfolio-edit-field__hint" style={{ marginTop: "0.25rem" }}>
              {(() => {
                const d = lastOutlookRefreshAt ? new Date(lastOutlookRefreshAt) : null;
                const ok = d && !Number.isNaN(d.getTime());
                if (!ok) {
                  return "Not recorded yet — use Refresh now to stamp a manual refresh (automated synthesis ships separately).";
                }
                const conf =
                  outlookConfidence != null && Number.isFinite(outlookConfidence)
                    ? `${Math.round(outlookConfidence * 100)}% confidence`
                    : null;
                const src =
                  typeof outlookRefreshSource === "string" && outlookRefreshSource.trim()
                    ? outlookRefreshSource.trim()
                    : "manual";
                return `${d.toLocaleString(undefined, {
                  dateStyle: "medium",
                  timeStyle: "short"
                })}${conf ? ` — ${conf}` : ""} (${src})`;
              })()}
            </p>
          </div>

          <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: "0.75rem" }}>
            <button
              type="button"
              className="cta cta-secondary"
              disabled={busy}
              aria-busy={refreshPending}
              aria-label="Refresh investment outlook now"
              onClick={() => void handleRefreshNow()}
            >
              {refreshPending ? "Refreshing…" : "Refresh now"}
            </button>
            <span className="portfolio-edit-field__hint" style={{ margin: 0 }}>
              Scheduled weekday runs use tenant ops configuration when the JVM job is enabled.
            </span>
          </div>
        </div>
      ) : null}

      {banner ? (
        <p className="status-text status-warn" role="status" style={{ margin: 0 }}>
          {banner}
        </p>
      ) : null}

      <p className="portfolio-edit-field__hint" style={{ margin: 0, fontSize: "0.7rem" }}>
        Tip: align outlook with your thesis before income scans — Neutral / Balanced favors defined-risk premium
        structures; Bullish / Aggressive allows more directional sizing within the band above.
      </p>
    </section>
  );
}
