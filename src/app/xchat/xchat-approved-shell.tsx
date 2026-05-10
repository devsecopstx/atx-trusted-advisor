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
import { logXchatPerfDebug } from "@/lib/xchat-debug";
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
  const shellStartedAt = Date.now();
  const isAdminSession = isGlobalAdmin(session.roles);
  const markPerf = (stage: string, startedAt: number, details?: Record<string, unknown>) => {
    logXchatPerfDebug({
      surface: "xchat_page",
      stage,
      durationMs: Date.now() - startedAt,
      details
    });
  };

  const defaultPersonaPromise = loadDefaultXchatPersonaForSessionDeduped(session.roles);

  const workspaceBookStartedAt = Date.now();
  const workspaceBookPromise = (async (): Promise<{
    workspaceBook: AppUserDefaultBook | null;
    workspacePortfolioId: string | null;
    syncWorkspacePortfolioCookie: boolean;
  }> => {
    if (requestedPortfolioId && ObjectId.isValid(requestedPortfolioId)) {
      const requestedBook = await loadAppUserDefaultBookForPortfolioId(session, requestedPortfolioId);
      if (requestedBook) {
        return {
          workspaceBook: requestedBook,
          workspacePortfolioId: requestedBook.portfolioId?.trim() ? requestedBook.portfolioId.trim() : null,
          syncWorkspacePortfolioCookie: true
        };
      }
    }
    const fallbackBook = await loadAppUserDefaultBook(session);
    return {
      workspaceBook: fallbackBook,
      workspacePortfolioId: fallbackBook?.portfolioId?.trim() ? fallbackBook.portfolioId.trim() : null,
      syncWorkspacePortfolioCookie: false
    };
  })();

  const workspaceLimitsPromise = getEffectiveWorkspaceLimitsForUser({
    tenantId: session.tenantId,
    userId: session.userId
  });
  const entitlementsPromise = resolveXoptionsEntitlements({
    userId: session.userId,
    roles: session.roles
  });
  const routePolicyPromise = getTenantRoutePolicyForSession(session);
  const tenantShellPromise =
    session.tenantId && ObjectId.isValid(session.tenantId)
      ? getTenantShellBrandingForHex(session.tenantId)
      : Promise.resolve(null);

  const [defaultPersona, workspaceBookState, wl, entitlements, routePolicy, tenantShell] =
    await Promise.all([
      defaultPersonaPromise,
      workspaceBookPromise,
      workspaceLimitsPromise,
      entitlementsPromise,
      routePolicyPromise,
      tenantShellPromise
    ]);
  markPerf("parallel_bootstrap", workspaceBookStartedAt, {
    usedRequestedPortfolio: workspaceBookState.syncWorkspacePortfolioCookie
  });

  const workspaceBook = workspaceBookState.workspaceBook;
  const workspacePortfolioId = workspaceBookState.workspacePortfolioId;
  const syncWorkspacePortfolioCookie = workspaceBookState.syncWorkspacePortfolioCookie;
  const workspaceChangePersonaEnabled = wl.changePersonaEnabled;
  const workspaceChatHistoryMax = wl.chatHistoryMax;
  const bootstrapStartedAt = Date.now();
  const serverBootstrap = await getXchatServerShellBootstrap(session, workspaceChatHistoryMax);
  markPerf("server_bootstrap", bootstrapStartedAt, {
    workspaceChatHistoryMax,
    hasHistory: Boolean(serverBootstrap?.historyItemsNewestFirst?.length)
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

  const visiblePathPrefixes = routePolicy.effectiveRolePolicy.allowedRoutes;
  const tenantWorkspaceSessionLabel = tenantShell?.displayName?.trim() || null;
  markPerf("render_ready", shellStartedAt, {
    workspaceChatHistoryMax,
    fileAttachmentsEnabled
  });

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
        isGlobalAdmin: isAdminSession
      }}
      accountFeedbackPageLabel="xChat"
      defaultPublishedPersonaName={defaultPersona?.name ?? "atx-trusted-advisor"}
      includeSuperAgentInPersonaPicker={isAdminSession}
      initialXchatItem={resolvedInitialXchatItem}
      isGlobalAdmin={isAdminSession}
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
