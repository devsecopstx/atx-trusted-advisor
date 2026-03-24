import { AtxFinanceMark, LightningBolt } from "./atxfinance-logo";
import { USER_PRODUCT_WHITELABEL_SUBLINE } from "./product-brand-constants";

const HEADER_MARK_SIZE = 24;
const HEADER_BOLT_SIZE = 18;

/**
 * xChat shell header: aTx mark + ⚡ + Trusted Advisor (matches {@link AtxFinanceLogo}), whitelabel subline.
 */
export function XchatHeaderBrand() {
  return (
    <div className="xf-logo-lockup-inline">
      <div className="xf-logo-row">
        <AtxFinanceMark size={HEADER_MARK_SIZE} />
        <LightningBolt size={HEADER_BOLT_SIZE} />
        <span className="xf-logo-text xf-logo-text--sm xf-logo-title-phrase xchat-header-brand-wordmark">
          <span className="xf-logo-title-trusted">Trusted</span>{" "}
          <span className="xf-logo-title-advisor">Advisor</span>
        </span>
      </div>
      <p className="xf-whitelabel-sub">{USER_PRODUCT_WHITELABEL_SUBLINE}</p>
    </div>
  );
}
