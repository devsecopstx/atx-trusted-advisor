import { loadAppUserDefaultBook } from "@/lib/app-user-default-book";
import { appUserPrimaryDisplayName } from "@/lib/app-user-primary-display-name";
import type { SessionUser } from "@/lib/auth";
import { getMongoConnectionLabel, shouldShowAppUserDbLabel } from "@/lib/env";
import { isGlobalAdmin } from "@/modules/identity/authorization";

import { AppUserAccountPublicRail } from "./app-user-rail-nav";

type AppUserAccountPublicRailForSessionProps = {
  session: SessionUser;
  /** Passed to feedback API as `page` when set; otherwise the account panel uses the current pathname. */
  feedbackPageLabel?: string;
};

export async function AppUserAccountPublicRailForSession({
  session,
  feedbackPageLabel
}: AppUserAccountPublicRailForSessionProps) {
  const book = await loadAppUserDefaultBook(session);
  const mongoConnection = shouldShowAppUserDbLabel() ? getMongoConnectionLabel() : "";
  const admin = isGlobalAdmin(session.roles);

  return (
    <AppUserAccountPublicRail
      accountDetails={{
        email: session.email,
        username: session.username,
        displayName: session.displayName,
        xUserId: session.xUserId,
        avatarUrl: session.avatarUrl,
        mongoConnection,
        isGlobalAdmin: admin
      }}
      accountFeedbackPageLabel={feedbackPageLabel}
      isGlobalAdmin={admin}
      railContext={{
        userDisplayName: appUserPrimaryDisplayName(session),
        book
      }}
    />
  );
}
