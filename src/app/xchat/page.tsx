import { AppUserApprovedHeader } from "@/app/ui/app_user-approved-header";
import { XchatGuestHeader } from "@/app/ui/xchat-guest-header";
import { loadAppUserDefaultBook, type AppUserDefaultBook } from "@/lib/app-user-default-book";
import { appUserPrimaryDisplayName } from "@/lib/app-user-primary-display-name";
import { getSessionUser, readPendingXLinkCookie } from "@/lib/auth";
import { getMongoConnectionLabel, isGoogleOAuthConfigured, shouldShowAppUserDbLabel } from "@/lib/env";
import { oauthAuthErrorMessages } from "@/lib/oauth-auth-error-messages";
import { loadDefaultXchatPersonaForSessionDeduped } from "@/lib/server-request-cache";
import { getEffectiveWorkspaceLimitsForUser } from "@/lib/tenant-workspace-limits";
import { canUserLogin, isGlobalAdmin } from "@/modules/identity/authorization";

import { XchatConversation } from "./ui/xchat-conversation";
import { XchatGuestPanel } from "./ui/xchat-guest-panel";
import { XchatGuestReadonlyShell } from "./ui/xchat-guest-readonly-shell";

type XchatPageProps = {
  searchParams: Promise<{
    error?: string;
    details?: string;
    rail?: string;
    item?: string;
  }>;
};

export default async function XchatPage({ searchParams }: XchatPageProps) {
  const params = await searchParams;
  const authError = typeof params.error === "string" ? params.error : undefined;
  const authDetails = typeof params.details === "string" ? params.details : undefined;
  const rail = typeof params.rail === "string" ? params.rail : "";
  const item = typeof params.item === "string" ? params.item : "";
  const initialXchatItem =
    rail === "xchat" && (item === "composer" || item === "persona" || item === "examples" || item === "history")
      ? item
      : null;
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
          <XchatGuestReadonlyShell showAccessPanel={false}>
            <XchatGuestPanel
              authDetails={authDetails}
              authError={authError}
              googleLoginHref={googleLoginHref}
              pendingXHandle={pendingXHandle}
            />
          </XchatGuestReadonlyShell>
        </div>
      </div>
    );
  }

  const approved = canUserLogin(session.roles);
  const defaultPersona = approved
    ? await loadDefaultXchatPersonaForSessionDeduped(session.roles)
    : null;

  let workspaceBook: AppUserDefaultBook | null = null;
  let workspacePortfolioId: string | null = null;
  let workspaceChangePersonaEnabled = true;
  let workspaceChatHistoryMax = 10;
  if (approved) {
    const book = await loadAppUserDefaultBook(session);
    if (book) {
      workspaceBook = book;
      workspacePortfolioId = book.portfolioId?.trim() ? book.portfolioId.trim() : null;
    }
    const wl = await getEffectiveWorkspaceLimitsForUser({
      tenantId: session.tenantId,
      userId: session.userId
    });
    workspaceChangePersonaEnabled = wl.changePersonaEnabled;
    workspaceChatHistoryMax = wl.chatHistoryMax;
  }

  const mongoConnection = shouldShowAppUserDbLabel() ? getMongoConnectionLabel() : "";

  const oauthLinkBannerMessage =
    approved && authError && oauthAuthErrorMessages[authError]
      ? oauthAuthErrorMessages[authError]
      : null;
  const googleLinkHrefForApproved =
    approved && googleLoginHref ? googleLoginHref : null;

  return (
    <div className="xchat-shell">
      {approved ? (
        <AppUserApprovedHeader current="xchat" feedbackPageLabel="xChat" session={session} />
      ) : (
        <XchatGuestHeader />
      )}

      <div className="xchat-body">
        {oauthLinkBannerMessage ? (
          <p
            className="xchat-oauth-inline-alert"
            role="alert"
            style={{
              margin: "0 0 0.75rem",
              padding: "0.6rem 0.75rem",
              borderRadius: 8,
              fontSize: "0.8rem",
              lineHeight: 1.4,
              background: "var(--xf-surface-800)",
              border: "1px solid var(--xf-border-subtle)",
              color: "var(--xf-text-secondary)"
            }}
          >
            {oauthLinkBannerMessage}
          </p>
        ) : null}
        {approved ? (
          <XchatConversation
            googleLinkHref={googleLinkHrefForApproved}
            accountDetails={{
              email: session.email,
              username: session.username,
              displayName: session.displayName,
              xUserId: session.xUserId,
              avatarUrl: session.avatarUrl,
              mongoConnection,
              isGlobalAdmin: isGlobalAdmin(session.roles)
            }}
            accountFeedbackPageLabel="xChat"
            defaultPublishedPersonaName={defaultPersona?.name ?? "atx-trusted-advisor"}
            includeSuperAgentInPersonaPicker={isGlobalAdmin(session.roles)}
            isGlobalAdmin={isGlobalAdmin(session.roles)}
            initialXchatItem={initialXchatItem}
            welcomeName={appUserPrimaryDisplayName(session)}
            workspaceChangePersonaEnabled={workspaceChangePersonaEnabled}
            workspaceChatHistoryMax={workspaceChatHistoryMax}
            workspaceBook={workspaceBook}
            workspacePortfolioId={workspacePortfolioId}
          />
        ) : (
          <XchatGuestReadonlyShell showAccessPanel={false}>
            <XchatGuestPanel
              authDetails={authDetails}
              authError={authError}
              googleLoginHref={googleLoginHref}
              pendingApproval
              pendingXHandle={pendingXHandle}
              userEmail={session.email}
            />
          </XchatGuestReadonlyShell>
        )}
      </div>
    </div>
  );
}
