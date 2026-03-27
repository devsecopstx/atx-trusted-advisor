import Link from "next/link";

import type { SessionUser } from "@/lib/auth";
import {
    getMongoConnectionLabel,
    shouldShowAppUserDbLabel
} from "@/lib/env";

import { AppUserHeaderSession } from "./app_user-header-session";
import { AppUserProductNav, type AppUserProductNavCurrent } from "./app_user-product-nav";
import { USER_PRODUCT_HOME_ARIA_LABEL } from "./product-brand-constants";
import { XchatHeaderBrand } from "./xchat-header-brand";

type AppUserApprovedHeaderProps = {
  session: SessionUser;
  current: AppUserProductNavCurrent;
  /** Shown with feedback for context (e.g. xChat, Portfolio). */
  feedbackPageLabel?: string;
};

export function AppUserApprovedHeader({
  session,
  current,
  feedbackPageLabel
}: AppUserApprovedHeaderProps) {
  const mongoConnection = shouldShowAppUserDbLabel()
    ? getMongoConnectionLabel()
    : "";

  return (
    <header className="xchat-header">
      <Link aria-label={USER_PRODUCT_HOME_ARIA_LABEL} className="xchat-header-brand" href="/xchat">
        <XchatHeaderBrand />
      </Link>
      <div className="xchat-header-main">
        <div className="xchat-header-trailing">
          <AppUserProductNav current={current} />
          <AppUserHeaderSession
            email={session.email}
            feedbackPageLabel={feedbackPageLabel}
            mongoConnection={mongoConnection}
            displayName={session.displayName}
            avatarUrl={session.avatarUrl}
            username={session.username}
            xUserId={session.xUserId}
          />
        </div>
      </div>
    </header>
  );
}
