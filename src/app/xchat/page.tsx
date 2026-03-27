import { AppUserApprovedHeader } from "@/app/ui/app_user-approved-header";
import { XchatGuestHeader } from "@/app/ui/xchat-guest-header";
import { getSessionUser, readPendingXLinkCookie } from "@/lib/auth";
import { isGoogleOAuthConfigured } from "@/lib/env";
import {
    getDefaultPortfolio,
    listPortfolioAccounts
} from "@/modules/core-admin/repository";
import { canUserLogin, isGlobalAdmin } from "@/modules/identity/authorization";
import { resolveDefaultXchatPersonaForSession } from "@/modules/xchat/repository";

import { XchatConversation } from "./ui/xchat-conversation";
import { XchatGuestPanel } from "./ui/xchat-guest-panel";

function xchatWelcomeLabel(session: { displayName?: string; username: string; email: string }): string {
  const d = session.displayName?.trim();
  if (d) return d;
  const u = session.username?.trim();
  if (u) return u.startsWith("@") ? u.slice(1) : u;
  const local = session.email.split("@")[0]?.trim();
  return local && local.length > 0 ? local : "there";
}

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
        <XchatGuestHeader />
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

  let defaultBookLabels: { portfolioName: string; accountName: string } | null = null;
  if (approved) {
    const portfolio = await getDefaultPortfolio(session.userId, { tenantId: session.tenantId });
    if (portfolio?._id) {
      const accounts = await listPortfolioAccounts({
        userId: session.userId,
        portfolioId: portfolio._id.toHexString(),
        tenantId: session.tenantId
      });
      const defaultAccount = accounts.find((a) => a.isDefault) ?? accounts[0];
      const portfolioName =
        portfolio.name && portfolio.name.trim().length > 0 ? portfolio.name.trim() : "Default portfolio";
      const accountName =
        defaultAccount?.name && defaultAccount.name.trim().length > 0
          ? defaultAccount.name.trim()
          : accounts.length === 0
            ? "No linked account"
            : "Account";
      defaultBookLabels = { portfolioName, accountName };
    }
  }

  return (
    <div className="xchat-shell">
      {approved ? (
        <AppUserApprovedHeader current="xchat" feedbackPageLabel="xChat" session={session} />
      ) : (
        <XchatGuestHeader />
      )}

      <div className="xchat-body">
        {approved ? (
          <XchatConversation
            defaultBookLabels={defaultBookLabels}
            defaultPublishedPersonaName={defaultPersona?.name ?? "atx-trusted-advisor"}
            includeSuperAgentInPersonaPicker={isGlobalAdmin(session.roles)}
            isGlobalAdmin={isGlobalAdmin(session.roles)}
            welcomeName={xchatWelcomeLabel(session)}
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
