import Link from "next/link";

import { USER_PRODUCT_HOME_ARIA_LABEL } from "@/app/ui/product-brand-constants";
import { PublicThemePicker } from "@/app/ui/public-theme-picker";
import { XchatHeaderBrand } from "@/app/ui/xchat-header-brand";

/**
 * xChat entry header when the user is not approved or not signed in — brand + shared theme picker.
 */
export function XchatGuestHeader() {
  return (
    <header className="xchat-header">
      <Link aria-label={USER_PRODUCT_HOME_ARIA_LABEL} className="xchat-header-brand" href="/xchat">
        <XchatHeaderBrand />
      </Link>
      <div className="xchat-header-main">
        <div className="xchat-header-trailing xchat-header-trailing--guest">
          <PublicThemePicker variant="xchat" />
        </div>
      </div>
    </header>
  );
}
