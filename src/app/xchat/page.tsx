import { AppUserApprovedHeader } from "@/app/ui/app_user-approved-header";
import { XchatGuestHeader } from "@/app/ui/xchat-guest-header";
import { loadAppUserDefaultBook } from "@/lib/app-user-default-book";
import { appUserPrimaryDisplayName } from "@/lib/app-user-primary-display-name";
import { getSessionUser, readPendingXLinkCookie } from "@/lib/auth";
import { isGoogleOAuthConfigured } from "@/lib/env";
import { loadDefaultXchatPersonaForSessionDeduped } from "@/lib/server-request-cache";
import { getEffectiveWorkspaceLimitsForUser } from "@/lib/tenant-workspace-limits";
import { canUserLogin, isGlobalAdmin } from "@/modules/identity/authorization";

import { XchatConversation } from "./ui/xchat-conversation";
import { XchatGuestPanel } from "./ui/xchat-guest-panel";
import { XchatGuestReadonlyShell } from "./ui/xchat-guest-readonly-shell";

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

  let defaultBookLabels: { portfolioName: string; accountName: string } | null = null;
  let workspaceChangePersonaEnabled = true;
  let workspaceChatHistoryMax = 10;
  if (approved) {
    const book = await loadAppUserDefaultBook(session);
    if (book) {
      defaultBookLabels = { portfolioName: book.portfolioName, accountName: book.accountName };
    }
    const wl = await getEffectiveWorkspaceLimitsForUser({
      tenantId: session.tenantId,
      userId: session.userId
    });
    workspaceChangePersonaEnabled = wl.changePersonaEnabled;
    workspaceChatHistoryMax = wl.chatHistoryMax;
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
            welcomeName={appUserPrimaryDisplayName(session)}
            workspaceChangePersonaEnabled={workspaceChangePersonaEnabled}
            workspaceChatHistoryMax={workspaceChatHistoryMax}
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
