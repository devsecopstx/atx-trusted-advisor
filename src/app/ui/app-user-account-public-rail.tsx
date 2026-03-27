import { loadAppUserDefaultBook } from "@/lib/app-user-default-book";
import { appUserPrimaryDisplayName } from "@/lib/app-user-primary-display-name";
import type { SessionUser } from "@/lib/auth";
import { isGlobalAdmin } from "@/modules/identity/authorization";

import { AppUserAccountPublicRail } from "./app-user-rail-nav";

type AppUserAccountPublicRailForSessionProps = {
  session: SessionUser;
};

export async function AppUserAccountPublicRailForSession({ session }: AppUserAccountPublicRailForSessionProps) {
  const book = await loadAppUserDefaultBook(session);
  return (
    <AppUserAccountPublicRail
      isGlobalAdmin={isGlobalAdmin(session.roles)}
      railContext={{
        userDisplayName: appUserPrimaryDisplayName(session),
        book
      }}
    />
  );
}
