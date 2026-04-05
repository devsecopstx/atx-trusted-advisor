"use client";

/** Short hint next to order inputs when Tax education is on. */
export function XoptionsTaxLimitHint() {
  return (
    <details className="mt-1 rounded border border-[color-mix(in_srgb,var(--xf-text-100)_8%,transparent)] p-1.5 text-[0.62rem]">
      <summary className="cursor-pointer font-medium text-[var(--xf-text-400)] outline-none focus-visible:ring-2 focus-visible:ring-[var(--xf-xoptions-accent)]">
        Tax note on premium (general)
      </summary>
      <p className="mt-1.5 mb-0 leading-relaxed text-[var(--xf-text-500)]">
        For buyers, premium is usually capitalized into the position; for sellers, premium may affect basis in the
        underlying if assigned. Rules vary by account type and election. Educational only.
      </p>
    </details>
  );
}

/**
 * Toggleable tax *education* blurbs only. Not tax advice.
 */
export function XoptionsTaxEducationPanels() {
  return (
    <div
      className="xoptions-tax-edu-panels space-y-2"
      aria-label="Tax education references"
    >
      <details className="xoptions-tax-edu-panels__detail rounded-md border border-[color-mix(in_srgb,var(--xf-text-100)_10%,transparent)] p-2">
        <summary className="cursor-pointer text-[0.7rem] font-medium text-[var(--xf-text-300)] outline-none focus-visible:ring-2 focus-visible:ring-[var(--xf-xoptions-accent)]">
          LEAPs vs short-dated (holding period)
        </summary>
        <p className="mt-2 mb-0 text-[0.65rem] leading-relaxed text-[var(--xf-text-400)]">
          Long-dated equity options may be taxed on sale or exercise under rules that differ from short-dated
          contracts. Character (short-term vs long-term capital gain) depends on holding period, exercise, and
          whether positions are offsetting. Educational only.
        </p>
      </details>
      <details className="xoptions-tax-edu-panels__detail rounded-md border border-[color-mix(in_srgb,var(--xf-text-100)_10%,transparent)] p-2">
        <summary className="cursor-pointer text-[0.7rem] font-medium text-[var(--xf-text-300)] outline-none focus-visible:ring-2 focus-visible:ring-[var(--xf-xoptions-accent)]">
          Qualified covered calls
        </summary>
        <p className="mt-2 mb-0 text-[0.65rem] leading-relaxed text-[var(--xf-text-400)]">
          IRS rules can suspend long-term treatment on stock if a covered call is deep ITM or too short to expiry.
          &quot;Qualified&quot; status depends on strike, expiry, and stock holding. Not determined by this app.
        </p>
      </details>
      <details className="xoptions-tax-edu-panels__detail rounded-md border border-[color-mix(in_srgb,var(--xf-text-100)_10%,transparent)] p-2">
        <summary className="cursor-pointer text-[0.7rem] font-medium text-[var(--xf-text-300)] outline-none focus-visible:ring-2 focus-visible:ring-[var(--xf-xoptions-accent)]">
          Wash-sale (stocks and options)
        </summary>
        <p className="mt-2 mb-0 text-[0.65rem] leading-relaxed text-[var(--xf-text-400)]">
          Losses on sale can be disallowed if you repurchase substantially identical stock or option positions within
          a window. Option contracts on the same underlying can interact with stock lots. Track at the custodian.
        </p>
      </details>
      <details className="xoptions-tax-edu-panels__detail rounded-md border border-[color-mix(in_srgb,var(--xf-text-100)_10%,transparent)] p-2">
        <summary className="cursor-pointer text-[0.7rem] font-medium text-[var(--xf-text-300)] outline-none focus-visible:ring-2 focus-visible:ring-[var(--xf-xoptions-accent)]">
          Section 1256 contracts
        </summary>
        <p className="mt-2 mb-0 text-[0.65rem] leading-relaxed text-[var(--xf-text-400)]">
          Certain futures-style and broad-based index options may be marked-to-market with 60/40 long-term/short-term
          split. Most single-stock equity options are not Section 1256. Custodian tax reports govern.
        </p>
      </details>
    </div>
  );
}
