import { AtxFinanceMark, LightningBolt } from "./atxfinance-logo";

const HEADER_MARK_SIZE = 24;
const HEADER_BOLT_SIZE = 18;
const HEADER_MARK_SIZE_COMPACT = 20;
const HEADER_BOLT_SIZE_COMPACT = 14;

type XchatHeaderBrandProps = {
  /** Tighter lockup for product headers where trailing chrome owns the right rail. */
  compact?: boolean;
};

/**
 * xChat shell header: aTx mark + ⚡ + Trusted Advisory with the compact brand tagline.
 */
export function XchatHeaderBrand({ compact = false }: XchatHeaderBrandProps) {
  const markSize = compact ? HEADER_MARK_SIZE_COMPACT : HEADER_MARK_SIZE;
  const boltSize = compact ? HEADER_BOLT_SIZE_COMPACT : HEADER_BOLT_SIZE;

  /** Compact rail/product headers: slightly smaller wordmark; tagline stays readable (HNWI desks). */
  const titleSizeClass = compact ? "text-lg" : "text-xl";
  const taglineSizeClass = compact ? "text-sm font-semibold" : "text-base font-semibold";

  return (
    <div
      className={`xf-logo-lockup-inline xf-logo-lockup-inline--header-single${compact ? " xf-logo-lockup-inline--header-compact" : ""}`}
    >
      <div className="xf-logo-row xf-logo-row--header-single">
        <AtxFinanceMark size={markSize} />
        <LightningBolt size={boltSize} />
        <span
          className={`xf-logo-title-phrase xchat-header-brand-wordmark ${titleSizeClass} font-bold tracking-tight`}
        >
          <span className="xf-logo-title-trusted">Trusted</span>{" "}
          <span className="xf-logo-title-advisor">Advisory</span>
        </span>
        <span
          className={`xf-header-tagline inline-flex items-baseline gap-x-1 whitespace-nowrap tracking-tight ${taglineSizeClass} ${compact ? "ml-1" : "ml-2"}`}
        >
          <span className="text-[var(--xf-text-100)]">No </span>
          <span className="xf-header-tagline-atoms font-bold text-[var(--xf-lightning-yellow)]">Atoms</span>
          <span className="text-[var(--xf-text-100)]"> moved, just </span>
          <span className="font-bold text-[var(--xf-gain-green)]">Gains</span>
          <span className="text-[var(--xf-text-100)]"> earned</span>
        </span>
      </div>
    </div>
  );
}
