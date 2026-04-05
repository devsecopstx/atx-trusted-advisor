"use client";

/**
 * Expandable Black–Scholes Greek references (educational; same model as chain greeks).
 */
export function XoptionsGreekCalcExplainer() {
  return (
    <div
      className="xoptions-greek-explainer mb-2 rounded-md border border-[color-mix(in_srgb,var(--xf-xoptions-accent)_28%,transparent)] bg-[color-mix(in_srgb,var(--xf-xoptions-accent)_6%,transparent)] p-2"
      aria-label="Greek calculation reference"
    >
      <p className="m-0 mb-2 text-[0.6rem] font-semibold uppercase tracking-[0.08em] text-[var(--xf-text-400)]">
        Black–Scholes (European). r = risk-free, σ = IV (decimal), T = years to expiry.
      </p>
      <div className="grid gap-1.5 sm:grid-cols-2">
        <details className="xoptions-greek-explainer__detail rounded border border-[color-mix(in_srgb,var(--xf-text-100)_10%,transparent)] bg-[color-mix(in_srgb,var(--xf-text-100)_4%,transparent)] p-2">
          <summary className="cursor-pointer text-[0.7rem] font-medium text-[var(--xf-text-200)] outline-none focus-visible:ring-2 focus-visible:ring-[var(--xf-xoptions-accent)]">
            Delta (Δ)
          </summary>
          <p className="mt-1.5 mb-0 font-mono text-[0.62rem] leading-snug text-[var(--xf-text-300)]">
            d₁ = (ln(S/K) + (r + σ²/2)T) / (σ√T)
            <br />
            Call Δ = N(d₁) · Put Δ = N(d₁) − 1 (per share)
          </p>
          <p className="mt-1.5 mb-0 text-[0.62rem] leading-relaxed text-[var(--xf-text-400)]">
            How much option value moves per $1 move in the stock, holding other inputs fixed. Ranges about 0–1
            for calls and −1–0 for puts.
          </p>
        </details>
        <details className="xoptions-greek-explainer__detail rounded border border-[color-mix(in_srgb,var(--xf-text-100)_10%,transparent)] bg-[color-mix(in_srgb,var(--xf-text-100)_4%,transparent)] p-2">
          <summary className="cursor-pointer text-[0.7rem] font-medium text-[var(--xf-text-200)] outline-none focus-visible:ring-2 focus-visible:ring-[var(--xf-xoptions-accent)]">
            Gamma (Γ)
          </summary>
          <p className="mt-1.5 mb-0 font-mono text-[0.62rem] leading-snug text-[var(--xf-text-300)]">
            Γ = N′(d₁) / (S · σ · √T)
          </p>
          <p className="mt-1.5 mb-0 text-[0.62rem] leading-relaxed text-[var(--xf-text-400)]">
            Rate of change of delta as spot moves. Highest near ATM; important for hedging frequency and pin risk
            into expiry.
          </p>
        </details>
        <details className="xoptions-greek-explainer__detail rounded border border-[color-mix(in_srgb,var(--xf-text-100)_10%,transparent)] bg-[color-mix(in_srgb,var(--xf-text-100)_4%,transparent)] p-2">
          <summary className="cursor-pointer text-[0.7rem] font-medium text-[var(--xf-text-200)] outline-none focus-visible:ring-2 focus-visible:ring-[var(--xf-xoptions-accent)]">
            Theta (Θ) per day
          </summary>
          <p className="mt-1.5 mb-0 font-mono text-[0.62rem] leading-snug text-[var(--xf-text-300)]">
            Θ = (∂V/∂t) / 365 (calendar day; sign per long/short)
          </p>
          <p className="mt-1.5 mb-0 text-[0.62rem] leading-relaxed text-[var(--xf-text-400)]">
            Time decay. Long premium is usually negative theta per day; short premium often collects theta. Not
            cash until you close or expire.
          </p>
        </details>
        <details className="xoptions-greek-explainer__detail rounded border border-[color-mix(in_srgb,var(--xf-text-100)_10%,transparent)] bg-[color-mix(in_srgb,var(--xf-text-100)_4%,transparent)] p-2">
          <summary className="cursor-pointer text-[0.7rem] font-medium text-[var(--xf-text-200)] outline-none focus-visible:ring-2 focus-visible:ring-[var(--xf-xoptions-accent)]">
            Vega (per 1% IV)
          </summary>
          <p className="mt-1.5 mb-0 font-mono text-[0.62rem] leading-snug text-[var(--xf-text-300)]">
            Vega = S · N′(d₁) · √T · 0.01
          </p>
          <p className="mt-1.5 mb-0 text-[0.62rem] leading-relaxed text-[var(--xf-text-400)]">
            Sensitivity to a one percentage-point change in implied volatility (e.g. 35% to 36%). Rises with time
            to expiry, other things equal.
          </p>
        </details>
      </div>
    </div>
  );
}
