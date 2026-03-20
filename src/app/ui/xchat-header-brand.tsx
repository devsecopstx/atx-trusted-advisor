import { AtxFinanceMark, LightningBolt } from "./atxfinance-logo";

const HEADER_MARK_SIZE = 24;
const HEADER_BOLT_SIZE = 18;

/**
 * xChat shell header: aTx (gain-green) + ⚡ (lightning-yellow) + xFinance (white), aligned with full lockup.
 */
export function XchatHeaderBrand() {
  return (
    <div className="xf-logo-lockup-inline">
      <div className="xf-logo-row">
        <AtxFinanceMark size={HEADER_MARK_SIZE} />
        <LightningBolt size={HEADER_BOLT_SIZE} />
        <span className="xf-logo-text xf-logo-text--sm xchat-header-brand-wordmark">
          xFinance
        </span>
      </div>
    </div>
  );
}
