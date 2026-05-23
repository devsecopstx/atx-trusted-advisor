"use client";

import { formatExpirationShortLabel, type XoptionsOpeningAction } from "@/lib/xoptions/xoptions-order-preview";

const ORDER_PREVIEW_DISCLAIMER =
  "Not financial, tax, or legal advice. Options involve substantial risk of loss. Model-based estimates and delayed quotes can differ from live execution outcomes.";

function usd(n: number): string {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(n);
}

type XoptionsOrderPreviewCardProps = {
  symbol: string;
  strike: number;
  expirationYyyyMmDd: string;
  quantity: number;
  optionSide: "call" | "put";
  openingAction: XoptionsOpeningAction;
  limitPricePerShare: number;
  probabilityOtmPercent: number | null;
  strategyType: string | null;
  chainId: string | null;
  backToChainHref?: string;
};

export function XoptionsOrderPreviewCard({
  symbol,
  strike,
  expirationYyyyMmDd,
  quantity,
  optionSide,
  openingAction,
  limitPricePerShare,
  probabilityOtmPercent,
  strategyType,
  chainId,
  backToChainHref = "#xoptions-chain-panel"
}: XoptionsOrderPreviewCardProps) {
  const contracts = Math.max(1, quantity);
  const shares = contracts * 100;
  const strikeDisplay = usd(strike);
  const expirationDisplay = formatExpirationShortLabel(expirationYyyyMmDd);
  const maxCashFlowUsd = contracts * 100 * Math.max(0, limitPricePerShare);
  const securedNotionalUsd = strike * shares;
  const potentialEarningPct =
    openingAction === "sell_to_open" && securedNotionalUsd > 0
      ? (maxCashFlowUsd / securedNotionalUsd) * 100
      : null;

  const openVerb = openingAction === "sell_to_open" ? "selling" : "buying";
  const contractLabel = optionSide === "call" ? "Call" : "Put";
  const contractLabelPlural = contracts === 1 ? contractLabel : `${contractLabel}s`;
  const maxCashflowLabel = openingAction === "sell_to_open" ? "Max Credit" : "Max Debit";
  const maxCashflowColor =
    openingAction === "sell_to_open" ? "text-xf-accent-cta" : "text-rose-600 dark:text-rose-500";
  const pOtmHelper =
    probabilityOtmPercent != null
      ? `${symbol.toUpperCase()} ${optionSide === "put" ? ">" : "<"} ${strikeDisplay} at expiration`
      : "Requires IV from selected chain leg";

  const obligationLine =
    openingAction === "sell_to_open"
      ? `If assigned, you may be obligated to ${optionSide === "put" ? "buy" : "sell"} ${shares.toLocaleString()} shares of ${symbol.toUpperCase()} at ${strikeDisplay} per share`
      : `If exercised, you have the right to ${optionSide === "put" ? "sell" : "buy"} ${shares.toLocaleString()} shares of ${symbol.toUpperCase()} at ${strikeDisplay} per share`;

  return (
    <section className="mt-2 rounded-md border border-[color-mix(in_srgb,var(--xf-text-100)_14%,transparent)] bg-[color-mix(in_srgb,var(--xf-text-100)_4%,transparent)] p-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <h4 className="m-0 text-sm font-bold leading-tight text-[var(--xf-text-100)]">
          You are {openVerb} <span className="font-bold">{contracts}</span>{" "}
          <span className="font-bold uppercase">{symbol}</span> <span className="font-bold">{strikeDisplay}</span>{" "}
          <span className="font-bold">{contractLabelPlural}</span> to open • Expires{" "}
          <span className="font-bold">{expirationDisplay}</span>
        </h4>
        <a
          href={backToChainHref}
          className="text-[0.64rem] font-semibold text-[color-mix(in_srgb,var(--xf-gain-green)_86%,var(--xf-text-100))] underline underline-offset-2 hover:text-[var(--xf-lightning-yellow)]"
        >
          Edit order
        </a>
      </div>

      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        <div className="rounded-sm border border-[color-mix(in_srgb,var(--xf-gain-green)_26%,transparent)] bg-[color-mix(in_srgb,var(--xf-gain-green)_9%,transparent)] p-2">
          <p className="m-0 text-[0.62rem] font-semibold uppercase tracking-[0.06em] text-[var(--xf-text-400)]">
            {maxCashflowLabel}
          </p>
          <p className={`mt-1 mb-0 text-base font-bold tabular-nums ${maxCashflowColor}`}>{usd(maxCashFlowUsd)}</p>
          <p className="mt-1 mb-0 text-[0.62rem] text-[var(--xf-text-500)]">
            Limit <span className="font-bold text-[var(--xf-text-300)]">{usd(limitPricePerShare)}</span> per share
          </p>
        </div>

        <div className="rounded-sm border border-[color-mix(in_srgb,var(--xf-text-100)_18%,transparent)] bg-[color-mix(in_srgb,var(--xf-text-100)_6%,transparent)] p-2">
          <p className="m-0 text-[0.62rem] font-semibold uppercase tracking-[0.06em] text-[var(--xf-text-400)]">P(OTM)</p>
          <p className="mt-1 mb-0 text-base font-bold tabular-nums text-[var(--xf-text-100)]">
            {probabilityOtmPercent != null ? `${probabilityOtmPercent}%` : "—"}
          </p>
          <p className="mt-1 mb-0 text-[0.62rem] text-[var(--xf-text-500)]">{pOtmHelper}</p>
        </div>
      </div>

      <div className="mt-3 rounded-sm border border-[color-mix(in_srgb,var(--xf-danger-400)_26%,transparent)] bg-[color-mix(in_srgb,var(--xf-danger-400)_8%,transparent)] p-2 text-[0.74rem] leading-relaxed text-[var(--xf-text-300)]">
        <span className="font-bold text-[var(--xf-text-100)]">{obligationLine}</span> → Total{" "}
        <span className="font-bold text-rose-600 dark:text-rose-500">{usd(securedNotionalUsd)}</span>.
      </div>

      {potentialEarningPct != null ? (
        <div className="mt-3 inline-flex max-w-full flex-wrap items-center gap-1 rounded-full border border-[color-mix(in_srgb,var(--xf-green-500)_38%,transparent)] bg-[color-mix(in_srgb,var(--xf-green-500)_14%,transparent)] px-3 py-1 text-[0.72rem] leading-relaxed text-[var(--xf-text-200)]">
          <span className="font-bold text-xf-accent-cta">Potential earnings:</span>
          <span className="font-bold text-xf-accent-cta">{potentialEarningPct.toFixed(1)}%</span>
          <span>of secured notional</span>
          <span className="font-bold text-[var(--xf-text-100)]">({usd(securedNotionalUsd)})</span>
        </div>
      ) : null}

      <div className="mt-3 border-t border-[color-mix(in_srgb,var(--xf-text-100)_10%,transparent)] pt-2 text-[0.58rem] leading-snug text-[var(--xf-text-500)]">
        <p className="m-0">
          Strategy: <span className="font-bold text-[var(--xf-text-300)]">{strategyType ?? "Single-leg option"}</span>
        </p>
        {chainId ? (
          <p className="mt-1 mb-0">
            Chain ID: <span className="font-mono text-[var(--xf-text-300)]">{chainId}</span>
          </p>
        ) : null}
        <p className="mt-1 mb-0">Data: Yahoo (delayed 15 min) • Model P(OTM) uses chain IV when available.</p>
      </div>

      <p className="mt-2 mb-0 border-t border-[color-mix(in_srgb,var(--xf-text-100)_10%,transparent)] pt-2 text-[0.56rem] leading-snug text-[var(--xf-text-500)]">
        {ORDER_PREVIEW_DISCLAIMER}
      </p>
    </section>
  );
}
