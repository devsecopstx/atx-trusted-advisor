import {
    XFINANCE_PREMIUM_CAPABILITIES,
    XFINANCE_PREMIUM_ILLUSTRATIVE_NOTE,
    XFINANCE_PREMIUM_POSITIONING,
    XFINANCE_PREMIUM_TIME_VALUE,
    XFINANCE_PREMIUM_VALUE_EYEBROW,
    XFINANCE_PREMIUM_VALUE_HEADLINE,
    XFINANCE_PREMIUM_VALUE_INTRO
} from "@/lib/marketing/xfinance-premium-value-proposition";

type XfinancePremiumValueBlockProps = {
  /** `marketing` = landing / hub bands; `doc` = resources article sections. */
  variant?: "marketing" | "doc";
  id?: string;
  className?: string;
};

export function XfinancePremiumValueBlock({
  variant = "marketing",
  id = "premium-value",
  className = ""
}: XfinancePremiumValueBlockProps) {
  if (variant === "doc") {
    return (
      <div className={className} id={id}>
        <section className="resources-doc-section">
          <p className="resources-doc-hero__eyebrow">{XFINANCE_PREMIUM_VALUE_EYEBROW}</p>
          <h2>{XFINANCE_PREMIUM_VALUE_HEADLINE}</h2>
          <p className="resources-doc-section__desc">{XFINANCE_PREMIUM_VALUE_INTRO}</p>
          <ul className="resources-about-list">
            {XFINANCE_PREMIUM_CAPABILITIES.map((item) => (
              <li key={item.title}>
                <strong>{item.title}</strong> — {item.description}
              </li>
            ))}
          </ul>
          <p className="resources-doc-section__desc">{XFINANCE_PREMIUM_POSITIONING}</p>
        </section>

        <section className="resources-doc-section">
          <h2>Time and value for Austin HNWI desks</h2>
          <p className="resources-doc-section__desc">
            <strong>{XFINANCE_PREMIUM_TIME_VALUE.audience}</strong>
          </p>
          <ul className="resources-doc-list">
            <li>{XFINANCE_PREMIUM_TIME_VALUE.manualEffort}</li>
            <li>{XFINANCE_PREMIUM_TIME_VALUE.compressed}</li>
            <li>{XFINANCE_PREMIUM_TIME_VALUE.roi}</li>
          </ul>
          <p className="resources-doc-footnote">{XFINANCE_PREMIUM_ILLUSTRATIVE_NOTE}</p>
        </section>
      </div>
    );
  }

  return (
    <section
      id={id}
      className={`border-t border-white/10 bg-[color-mix(in_srgb,var(--xf-bg-900)_88%,var(--xf-surface-700))] py-14 sm:py-20 ${className}`.trim()}
      aria-label={XFINANCE_PREMIUM_VALUE_HEADLINE}
    >
      <div className="mx-auto max-w-screen-2xl px-4 sm:px-8">
        <div className="mx-auto max-w-4xl text-center">
          <p className="text-xs font-semibold uppercase tracking-widest text-[var(--xf-gain-green)]">
            {XFINANCE_PREMIUM_VALUE_EYEBROW}
          </p>
          <h2 className="mt-3 text-3xl font-extrabold tracking-tight text-[var(--xf-text-100)] sm:text-4xl">
            {XFINANCE_PREMIUM_VALUE_HEADLINE}
          </h2>
          <p className="mx-auto mt-4 max-w-3xl text-base leading-relaxed text-[var(--xf-text-300)] sm:text-lg">
            {XFINANCE_PREMIUM_VALUE_INTRO}
          </p>
        </div>

        <ul className="mx-auto mt-10 grid max-w-5xl gap-4 sm:grid-cols-2 lg:gap-5">
          {XFINANCE_PREMIUM_CAPABILITIES.map((item) => (
            <li
              key={item.title}
              className="rounded-2xl border border-white/10 bg-[var(--xf-surface-700)]/80 p-5 sm:p-6"
            >
              <h3 className="text-base font-semibold text-[var(--xf-text-100)] sm:text-lg">{item.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-[var(--xf-text-300)]">{item.description}</p>
            </li>
          ))}
        </ul>

        <p className="mx-auto mt-8 max-w-4xl text-center text-base leading-relaxed text-[var(--xf-text-200)] sm:text-lg">
          {XFINANCE_PREMIUM_POSITIONING}
        </p>

        <div className="mx-auto mt-10 max-w-3xl rounded-2xl border border-[color-mix(in_srgb,var(--xf-gain-green)_20%,transparent)] bg-[var(--xf-surface-700)]/90 p-6 sm:p-8">
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[var(--xf-gain-green)]">
            Time / value — illustrative desk math
          </p>
          <p className="mt-3 text-sm font-semibold text-[var(--xf-text-100)] sm:text-base">
            {XFINANCE_PREMIUM_TIME_VALUE.audience}
          </p>
          <ul className="mt-4 space-y-3 text-sm leading-relaxed text-[var(--xf-text-300)] sm:text-base">
            <li>{XFINANCE_PREMIUM_TIME_VALUE.manualEffort}</li>
            <li>{XFINANCE_PREMIUM_TIME_VALUE.compressed}</li>
            <li>{XFINANCE_PREMIUM_TIME_VALUE.roi}</li>
          </ul>
          <p className="mt-4 text-xs text-[var(--xf-text-400)]">{XFINANCE_PREMIUM_ILLUSTRATIVE_NOTE}</p>
        </div>
      </div>
    </section>
  );
}
