import Link from "next/link";

import type { SessionUser } from "@/lib/auth";

import type { AppUserProductNavCurrent } from "./app_user-product-nav";
import { USER_PRODUCT_HOME_ARIA_LABEL } from "./product-brand-constants";
import { XchatHeaderBrand } from "./xchat-header-brand";

type AppUserApprovedHeaderProps = {
  session: SessionUser;
  current: AppUserProductNavCurrent;
  /** Kept for call-site compatibility; account feedback uses the sidebar or pathname. */
  feedbackPageLabel?: string;
};

export function AppUserApprovedHeader(props: AppUserApprovedHeaderProps) {
  void props.session;
  void props.current;
  void props.feedbackPageLabel;

  return (
    <header className="xchat-header">
      <Link aria-label={USER_PRODUCT_HOME_ARIA_LABEL} className="xchat-header-brand" href="/xchat">
        <XchatHeaderBrand />
      </Link>
    </header>
  );
}
