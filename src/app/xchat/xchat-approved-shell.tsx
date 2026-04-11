import { ObjectId } from "mongodb";

import { XchatConversationMount } from "@/app/xchat/xchat-conversation-mount";
import type { AppUserDefaultBook } from "@/lib/app-user-default-book";
import {
    loadAppUserDefaultBook,
    loadAppUserDefaultBookForPortfolioId
} from "@/lib/app-user-default-book";
import { appUserPrimaryDisplayName } from "@/lib/app-user-primary-display-name";
import type { SessionUser } from "@/lib/auth";
import { getMongoConnectionLabel, isGoogleOAuthConfigured, shouldShowAppUserDbLabel } from "@/lib/env";
import { loadDefaultXchatPersonaForSessionDeduped } from "@/lib/server-request-cache";
import { getEffectiveWorkspaceLimitsForUser } from "@/lib/tenant-workspace-limits";
import { canAccessPremiumTenantAttachments } from "@/lib/xchat-premium-attachments-policy";
import { getXchatServerShellBootstrap } from "@/lib/xchat/xchat-shell-bootstrap";
import { isGlobalAdmin } from "@/modules/identity/authorization";
import { resolveXoptionsEntitlements } from "@/modules/xoptions/entitlements";

type XchatApprovedShellProps = {
  session: SessionUser;
  initialXchatItem: "composer" | "persona" | "examples" | "history" | "attachments" | null;
  requestedPortfolioId: string;
};

export async function XchatApprovedShell({
  session,
  initialXchatItem,
  requestedPortfolioId
}: XchatApprovedShellProps) {
  const defaultPersona = await loadDefaultXchatPersonaForSessionDeduped(session.roles);

  let workspaceBook: AppUserDefaultBook | null = null;
  let workspacePortfolioId: string | null = null;
  let syncWorkspacePortfolioCookie = false;
  if (requestedPortfolioId && ObjectId.isValid(requestedPortfolioId)) {
    const book = await loadAppUserDefaultBookForPortfolioId(session, requestedPortfolioId);
    if (book) {
      workspaceBook = book;
      workspacePortfolioId = book.portfolioId?.trim() ? book.portfolioId.trim() : null;
      syncWorkspacePortfolioCookie = true;
    }
  }
  if (!workspaceBook) {
    const book = await loadAppUserDefaultBook(session);
    if (book) {
      workspaceBook = book;
      workspacePortfolioId = book.portfolioId?.trim() ? book.portfolioId.trim() : null;
    }
  }

  const wl = await getEffectiveWorkspaceLimitsForUser({
    tenantId: session.tenantId,
    userId: session.userId
  });
  const workspaceChangePersonaEnabled = wl.changePersonaEnabled;
  const workspaceChatHistoryMax = wl.chatHistoryMax;

  const serverBootstrap = await getXchatServerShellBootstrap(session, workspaceChatHistoryMax);

  const entitlements = await resolveXoptionsEntitlements({
    userId: session.userId,
    roles: session.roles
  });
  const fileAttachmentsEnabled = canAccessPremiumTenantAttachments(
    entitlements.subscriptionPlan,
    session.roles
  );
  const resolvedInitialXchatItem =
    initialXchatItem === "attachments" && !fileAttachmentsEnabled ? null : initialXchatItem;

  const mongoConnection = shouldShowAppUserDbLabel() ? getMongoConnectionLabel() : "";
  const googleLoginHrefApproved = isGoogleOAuthConfigured()
    ? `/api/auth/google/login?next=${encodeURIComponent("/xchat")}`
    : null;
  const googleLinkHrefForApproved = googleLoginHrefApproved ? googleLoginHrefApproved : null;

  return (
    <XchatConversationMount
      googleLinkHref={googleLinkHrefForApproved}
      accountDetails={{
        email: session.email,
        username: session.username,
        displayName: session.displayName,
        xUserId: session.xUserId,
        avatarUrl: session.avatarUrl,
        mongoConnection,
        tenantIdHex: session.tenantId?.trim() || undefined,
        subscriptionPlan: entitlements.subscriptionPlan,
        isGlobalAdmin: isGlobalAdmin(session.roles)
      }}
      accountFeedbackPageLabel="xChat"
      defaultPublishedPersonaName={defaultPersona?.name ?? "atx-trusted-advisor"}
      includeSuperAgentInPersonaPicker={isGlobalAdmin(session.roles)}
      initialXchatItem={resolvedInitialXchatItem}
      isGlobalAdmin={isGlobalAdmin(session.roles)}
      serverBootstrap={serverBootstrap}
      welcomeName={appUserPrimaryDisplayName(session)}
      workspaceBook={workspaceBook}
      workspaceChangePersonaEnabled={workspaceChangePersonaEnabled}
      workspaceChatHistoryMax={workspaceChatHistoryMax}
      workspacePortfolioId={workspacePortfolioId}
      syncWorkspacePortfolioCookie={syncWorkspacePortfolioCookie}
    />
  );
}
