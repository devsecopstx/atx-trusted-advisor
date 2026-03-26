import { AtxFinanceMark, LightningBolt } from "./atxfinance-logo";

const HEADER_MARK_SIZE = 24;
const HEADER_BOLT_SIZE = 18;

/**
 * xChat shell header: aTx mark + ⚡ + Trusted Advisory with the compact brand tagline.
 */
export function XchatHeaderBrand() {
  return (
    <div className="xf-logo-lockup-inline xf-logo-lockup-inline--header-single">
      <div className="xf-logo-row xf-logo-row--header-single">
        <AtxFinanceMark size={HEADER_MARK_SIZE} />
        <LightningBolt size={HEADER_BOLT_SIZE} />
        <span className="xf-logo-text xf-logo-text--sm xf-logo-title-phrase xchat-header-brand-wordmark">
          <span className="xf-logo-title-trusted">Trusted</span>{" "}
          <span className="xf-logo-title-advisor">Advisory</span>
        </span>
        <span className="xf-header-tagline xf-header-tagline--inline">
          <span className="xf-header-tagline-rest">No </span>
          <span className="xf-header-tagline-atoms">Atoms</span>
          <span className="xf-header-tagline-rest"> moved, just </span>
          <span className="xf-header-tagline-gains">Gains</span>
          <span className="xf-header-tagline-rest"> earned</span>
        </span>
      </div>
    </div>
  );
}
