import { ObjectId } from "mongodb";
import { redirect } from "next/navigation";

import { WorkspaceProductLegalFooter } from "@/app/ui/workspace-product-legal-footer";
import { XchatConversationMount } from "@/app/xchat/xchat-conversation-mount";
import type { AppUserDefaultBook } from "@/lib/app-user-default-book";
import {
    loadAppUserDefaultBook,
    loadAppUserDefaultBookForPortfolioId
} from "@/lib/app-user-default-book";
import { appUserPrimaryDisplayName } from "@/lib/app-user-primary-display-name";
import type { SessionUser } from "@/lib/auth";
import { getMongoConnectionLabel, isGoogleOAuthConfigured, shouldShowAppUserDbLabel } from "@/lib/env";
import { getTenantShellBrandingForHexCached } from "@/lib/identity-shell-cache";
import { resolvePrimaryPlatformRoleForDisplay } from "@/lib/platform-role-display";
import { getTenantByHexIdCached, loadDefaultXchatPersonaForSessionDeduped } from "@/lib/server-request-cache";
import { getEffectiveWorkspaceLimitsForUser } from "@/lib/tenant-workspace-limits";
import { logXchatPerfDebug } from "@/lib/xchat-debug";
import { canAccessPremiumTenantAttachments } from "@/lib/xchat-premium-attachments-policy";
import {
    serializeOutlookDeskForXchatShell,
    type XchatInitialOutlookDesk
} from "@/lib/xchat/xchat-outlook-desk";
import { getXchatServerShellBootstrap } from "@/lib/xchat/xchat-shell-bootstrap";
import { advisorComplianceRequiresChatHistoryRetention } from "@/modules/compliance/advisor-compliance";
import { resolveAdvisorComplianceStatusForSession } from "@/modules/compliance/advisor-compliance-gate";
import { advisorComplianceWorkspaceRedirectPath } from "@/modules/compliance/advisor-compliance-redirect";
import { getAdvisorComplianceProfileForUser } from "@/modules/compliance/repository";
import { isAdvisorPlatformRole, isGlobalAdmin } from "@/modules/identity/authorization";
import { getTenantRoutePolicyForSession } from "@/modules/platform/tenant-route-policy";
import { resolveAccountOutlookContextForXchat } from "@/modules/xchat/account-outlook-context";
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
  const isAdminSession = isGlobalAdmin(session.roles);
  if (!isAdminSession && isAdvisorPlatformRole(session.roles)) {
    const tenant =
      session.tenantId && ObjectId.isValid(session.tenantId)
        ? await getTenantByHexIdCached(session.tenantId)
        : null;
    const complianceStatus = await resolveAdvisorComplianceStatusForSession({
      userId: session.userId,
      tenantId: session.tenantId,
      roles: session.roles,
      tenant
    });
    if (!complianceStatus.complete) {
      redirect(advisorComplianceWorkspaceRedirectPath("xchat"));
    }
  }
  const markPerf = (stage: string, details?: Record<string, unknown>) => {
    logXchatPerfDebug({
      surface: "xchat_page",
      stage,
      durationMs: 0,
      details
    });
  };

  const defaultPersonaPromise = loadDefaultXchatPersonaForSessionDeduped(session.roles);

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
      ? getTenantShellBrandingForHexCached(session.tenantId)
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
  markPerf("parallel_bootstrap", {
    usedRequestedPortfolio: workspaceBookState.syncWorkspacePortfolioCookie
  });

  const workspaceBook = workspaceBookState.workspaceBook;
  const workspacePortfolioId = workspaceBookState.workspacePortfolioId;
  const syncWorkspacePortfolioCookie = workspaceBookState.syncWorkspacePortfolioCookie;
  const workspaceChangePersonaEnabled = wl.changePersonaEnabled;
  const workspaceChatHistoryMax = wl.chatHistoryMax;
  const portfolioHexForOutlook = workspacePortfolioId?.trim() ?? "";
  const complianceProfilePromise =
    isAdvisorPlatformRole(session.roles) && !isGlobalAdmin(session.roles)
      ? getAdvisorComplianceProfileForUser(session.userId)
      : Promise.resolve(null);
  const [serverBootstrap, initialOutlookDesk, complianceProfile] = await Promise.all([
    getXchatServerShellBootstrap(session, workspaceChatHistoryMax),
    portfolioHexForOutlook
      ? resolveAccountOutlookContextForXchat({
          userId: session.userId,
          tenantId: session.tenantId,
          portfolioIdHex: portfolioHexForOutlook
        }).then((ctx) => serializeOutlookDeskForXchatShell(portfolioHexForOutlook, ctx))
      : Promise.resolve(null as XchatInitialOutlookDesk | null),
    complianceProfilePromise
  ]);
  const chatHistoryRetentionRequired = advisorComplianceRequiresChatHistoryRetention(complianceProfile);
  markPerf("server_bootstrap", {
    workspaceChatHistoryMax,
    hasHistory: Boolean(serverBootstrap?.historyItemsNewestFirst?.length),
    hasOutlookDesk: Boolean(initialOutlookDesk)
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
  markPerf("render_ready", {
    workspaceChatHistoryMax,
    fileAttachmentsEnabled
  });

  return (
    <div className="xchat-approved-shell flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
      <XchatConversationMount
      initialOutlookDesk={initialOutlookDesk}
      googleLinkHref={googleLinkHrefForApproved}
      mainFooter={<WorkspaceProductLegalFooter />}
      accountDetails={{
        email: session.email,
        username: session.username,
        displayName: session.displayName,
        xUserId: session.xUserId,
        avatarUrl: session.avatarUrl,
        mongoConnection,
        tenantIdHex: session.tenantId?.trim() || undefined,
        subscriptionPlan: entitlements.subscriptionPlan,
        isGlobalAdmin: isAdminSession,
        platformRole: resolvePrimaryPlatformRoleForDisplay(session.roles)
      }}
      accountFeedbackPageLabel="xChat"
      defaultPublishedPersonaName={defaultPersona?.name ?? "atx-trusted-advisor"}
      includeSuperAgentInPersonaPicker={isAdminSession}
      initialXchatItem={resolvedInitialXchatItem}
      isGlobalAdmin={isAdminSession}
      chatHistoryRetentionRequired={chatHistoryRetentionRequired}
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
    </div>
  );
}
