import { ObjectId } from "mongodb";

import { GlobalFooter } from "@/app/ui/global-footer";
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
import { getTenantShellBrandingForHex } from "@/modules/identity/repository";
import { getTenantRoutePolicyForSession } from "@/modules/platform/tenant-route-policy";
import { resolveXoptionsEntitlements } from "@/modules/xoptions/entitlements";

type XchatApprovedShellProps = {
  session: SessionUser;
  initialXchatItem:
    | "composer"
    | "persona"
    | "examples"
    | "example-prompts"
    | "history"
    | "attachments"
    | null;
  requestedPortfolioId: string;
  /** Deep-link workspace account (Portfolio desk); optional. */
  requestedAccountId: string;
};

export async function XchatApprovedShell({
  session,
  initialXchatItem,
  requestedPortfolioId,
  requestedAccountId
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

  const routePolicy = await getTenantRoutePolicyForSession(session);
  const visiblePathPrefixes = routePolicy.effectiveRolePolicy.allowedRoutes;

  const tenantShell =
    session.tenantId && ObjectId.isValid(session.tenantId)
      ? await getTenantShellBrandingForHex(session.tenantId)
      : null;
  const tenantWorkspaceSessionLabel = tenantShell?.displayName?.trim() || null;

  return (
    <XchatConversationMount
      googleLinkHref={googleLinkHrefForApproved}
      mainFooter={<GlobalFooter />}
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
      requestedWorkspaceAccountId={requestedAccountId ? requestedAccountId : null}
      tenantWorkspaceSessionLabel={tenantWorkspaceSessionLabel}
      visiblePathPrefixes={visiblePathPrefixes}
    />
  );
}
