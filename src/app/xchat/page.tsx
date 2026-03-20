import Link from "next/link";

import { AppUserApprovedHeader } from "@/app/ui/app_user-approved-header";
import { XchatHeaderBrand } from "@/app/ui/xchat-header-brand";
import { getSessionUser } from "@/lib/auth";
import { canUserLogin, isGlobalAdmin } from "@/modules/identity/authorization";

import { PlansLanding } from "./ui/plans-landing";
import { XchatConversation } from "./ui/xchat-conversation";
import { XchatGuestPanel } from "./ui/xchat-guest-panel";
export default async function XchatPage() {
  const session = await getSessionUser();
  if (!session) {
    return (
      <div className="xchat-shell">
        <header className="xchat-header">
          <Link aria-label="aTX Finance — xChat home" className="xchat-header-brand" href="/xchat">
            <XchatHeaderBrand />
          </Link>
        </header>
        <div className="xchat-body">
          <XchatGuestPanel />
        </div>
      </div>
    );
  }

  const approved = canUserLogin(session.roles);
  const admin = isGlobalAdmin(session.roles);

  return (
    <div className="xchat-shell">
      {approved ? (
        <AppUserApprovedHeader current="xchat" feedbackPageLabel="xChat" session={session} />
      ) : (
        <header className="xchat-header">
          <Link aria-label="aTX Finance — xChat home" className="xchat-header-brand" href="/xchat">
            <XchatHeaderBrand />
          </Link>
        </header>
      )}

      <div className="xchat-body">
        {approved ? (
          <XchatConversation defaultPublishedPersonaName={admin ? "Super-Agent" : "xFinance"} />
        ) : (
          <PlansLanding userEmail={session.email} username={session.username} />
        )}
      </div>
    </div>
  );
}
