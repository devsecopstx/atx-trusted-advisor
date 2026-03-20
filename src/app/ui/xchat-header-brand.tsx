import { AtxFinanceMark } from "./atxfinance-logo";

const HEADER_MARK_SIZE = 24;

/**
 * xChat shell header: xf-logo-mark (aTx, gain-green) + xFinance (white). Same lockup as admin/app.
 */
export function XchatHeaderBrand() {
  return (
    <div className="xf-logo-lockup-inline">
      <div className="xf-logo-row">
        <AtxFinanceMark size={HEADER_MARK_SIZE} />
        <span className="xf-logo-text xf-logo-text--sm xchat-header-brand-wordmark">
          xFinance
        </span>
      </div>
    </div>
  );
}
