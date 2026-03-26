import Link from "next/link";

import { AppUserApprovedHeader } from "@/app/ui/app_user-approved-header";
import { USER_PRODUCT_HOME_ARIA_LABEL } from "@/app/ui/product-brand-constants";
import { XchatHeaderBrand } from "@/app/ui/xchat-header-brand";
import { getSessionUser, readPendingXLinkCookie } from "@/lib/auth";
import { isGoogleOAuthConfigured } from "@/lib/env";
import { canUserLogin, isGlobalAdmin } from "@/modules/identity/authorization";
import { resolveDefaultXchatPersonaForSession } from "@/modules/xchat/repository";

import { XchatConversation } from "./ui/xchat-conversation";
import { XchatGuestPanel } from "./ui/xchat-guest-panel";
type XchatPageProps = {
  searchParams: Promise<{ error?: string; details?: string }>;
};

export default async function XchatPage({ searchParams }: XchatPageProps) {
  const params = await searchParams;
  const authError = typeof params.error === "string" ? params.error : undefined;
  const authDetails = typeof params.details === "string" ? params.details : undefined;
  const pendingXHandle =
    authError === "email_link_required"
      ? (await readPendingXLinkCookie())?.username
      : undefined;

  const googleLoginHref = isGoogleOAuthConfigured()
    ? `/api/auth/google/login?next=${encodeURIComponent("/xchat")}`
    : null;

  const session = await getSessionUser();
  if (!session) {
    return (
      <div className="xchat-shell">
        <header className="xchat-header">
          <Link aria-label={USER_PRODUCT_HOME_ARIA_LABEL} className="xchat-header-brand" href="/xchat">
            <XchatHeaderBrand />
          </Link>
        </header>
        <div className="xchat-body">
          <XchatGuestPanel
            authDetails={authDetails}
            authError={authError}
            googleLoginHref={googleLoginHref}
            pendingXHandle={pendingXHandle}
          />
        </div>
      </div>
    );
  }

  const approved = canUserLogin(session.roles);
  const defaultPersona = approved
    ? await resolveDefaultXchatPersonaForSession(session.roles)
    : null;

  return (
    <div className="xchat-shell">
      {approved ? (
        <AppUserApprovedHeader current="xchat" feedbackPageLabel="xChat" session={session} />
      ) : (
        <header className="xchat-header">
          <Link aria-label={USER_PRODUCT_HOME_ARIA_LABEL} className="xchat-header-brand" href="/xchat">
            <XchatHeaderBrand />
          </Link>
        </header>
      )}

      <div className="xchat-body">
        {approved ? (
          <XchatConversation
            defaultPublishedPersonaName={defaultPersona?.name ?? "atx-trusted-advisor"}
            includeSuperAgentInPersonaPicker={isGlobalAdmin(session.roles)}
          />
        ) : (
          <XchatGuestPanel
            authDetails={authDetails}
            authError={authError}
            googleLoginHref={googleLoginHref}
            pendingApproval
            pendingXHandle={pendingXHandle}
            userEmail={session.email}
          />
        )}
      </div>
    </div>
  );
}
