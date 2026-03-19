import { AtxFinanceMark } from "./atxfinance-logo";

const HEADER_MARK_SIZE = 24;

/**
 * xChat shell header wordmark: **aTx** (gain-green) + **Finance** (`xf-logo-x-letter`, white).
 */
export function XchatHeaderBrand() {
  return (
    <div className="xf-logo-lockup-inline">
      <div className="xf-logo-row">
        <AtxFinanceMark size={HEADER_MARK_SIZE} />
        <span className="xf-logo-text xf-logo-text--sm">
          <span className="xchat-header-brand-atx">aTx</span>{" "}
          <span className="xf-logo-x-letter">Finance</span>
        </span>
      </div>
    </div>
  );
}
