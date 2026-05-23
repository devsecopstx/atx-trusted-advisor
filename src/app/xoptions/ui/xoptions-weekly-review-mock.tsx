"use client";

/**
 * Marketing / weekly-review screenshot mock for xOptions + portfolio context.
 * Render at `/xoptions/weekly-review-mock` or export from design reviews.
 */
export function XoptionsWeeklyReviewScreenshotMock() {
  return (
    <div
      className="mx-auto w-full max-w-[720px] overflow-hidden rounded-[var(--xf-radius-md)] border border-[color-mix(in_srgb,var(--xf-green-500)_28%,transparent)] bg-[var(--xf-bg-900)] shadow-[0_24px_80px_-24px_rgba(0,0,0,0.85)]"
      role="img"
      aria-label="xOptions weekly review mock — portfolio context, what worked metrics, educational footer"
    >
      <header className="flex items-center justify-between border-b border-white/10 px-4 py-3">
        <div>
          <p className="m-0 text-[0.65rem] font-semibold uppercase tracking-[0.14em] text-[var(--xf-green-500)]">
            aTx⚡Finance · xOptions
          </p>
          <h2 className="m-0 mt-0.5 text-base font-bold text-[var(--xf-text-100)]">Weekly desk review</h2>
        </div>
        <span className="rounded-full border border-white/15 px-2 py-0.5 font-mono text-[0.65rem] text-[var(--xf-text-300)]">
          May 22, 2026
        </span>
      </header>

      <div className="grid gap-3 px-4 py-3 sm:grid-cols-[1.1fr_0.9fr]">
        <section className="rounded-[var(--xf-radius-md)] border border-white/10 bg-[var(--xf-surface-700)]/80 p-3">
          <p className="m-0 text-[0.62rem] font-semibold uppercase tracking-wider text-[var(--xf-text-400)]">
            Portfolio context
          </p>
          <p className="m-0 mt-1 text-sm font-semibold text-[var(--xf-text-100)]">HNWI Growth · Fidelity ****4821</p>
          <ul className="m-0 mt-2 list-none space-y-1 p-0 font-mono text-[0.72rem] text-[var(--xf-text-300)]">
            <li>TSLA 400 sh · 18.2% book</li>
            <li>RKLB 2,500 sh · 11.4% book</li>
            <li>Cash $142,800 · options approved</li>
          </ul>
        </section>

        <section className="rounded-[var(--xf-radius-md)] border border-white/10 bg-[var(--xf-surface-700)]/80 p-3">
          <p className="m-0 text-[0.62rem] font-semibold uppercase tracking-wider text-[var(--xf-text-400)]">
            Scanner refresh
          </p>
          <dl className="m-0 mt-2 grid grid-cols-2 gap-x-2 gap-y-1 font-mono text-[0.72rem]">
            <dt className="text-[var(--xf-text-500)]">IV rank floor</dt>
            <dd className="m-0 text-[var(--xf-green-500)]">&gt; 45%</dd>
            <dt className="text-[var(--xf-text-500)]">Straddle |Δ|</dt>
            <dd className="m-0 text-[var(--xf-text-200)]">0.15 – 0.30</dd>
            <dt className="text-[var(--xf-text-500)]">Top idea</dt>
            <dd className="m-0 text-[var(--xf-text-200)]">Wheel + collar</dd>
          </dl>
        </section>
      </div>

      <section className="mx-4 mb-3 rounded-[var(--xf-radius-md)] border border-white/10 bg-[color-mix(in_srgb,var(--xf-green-500)_8%,var(--xf-surface-700))] p-3">
        <p className="m-0 text-[0.62rem] font-semibold uppercase tracking-wider text-[var(--xf-text-400)]">
          What worked
        </p>
        <div className="mt-2 grid gap-2 sm:grid-cols-3">
          {[
            { label: "Premium captured", value: "+$4,280", sub: "3 CSP/CC cycles" },
            { label: "Avg fit score", value: "87", sub: "IV rank &gt; 45 names" },
            { label: "Max book drawdown", value: "−6.2%", sub: "within 15% gate" }
          ].map((m) => (
            <div
              key={m.label}
              className="rounded border border-white/10 bg-[var(--xf-bg-900)]/60 px-2 py-2 text-center"
            >
              <p className="m-0 text-[0.58rem] uppercase tracking-wide text-[var(--xf-text-500)]">{m.label}</p>
              <p className="m-0 mt-0.5 text-lg font-bold text-[var(--xf-green-500)]">{m.value}</p>
              <p className="m-0 mt-0.5 text-[0.62rem] text-[var(--xf-text-400)]">{m.sub}</p>
            </div>
          ))}
        </div>
      </section>

      <footer className="border-t border-white/10 bg-[var(--xf-bg-900)] px-4 py-2.5 text-center">
        <p className="m-0 text-[0.68rem] font-semibold uppercase tracking-[0.12em] text-[var(--xf-warning-400)]">
          Educational use only — not financial advice
        </p>
      </footer>
    </div>
  );
}
