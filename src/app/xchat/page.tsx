import { Suspense } from "react";

import { AppUserAccountPublicRailForSession } from "@/app/ui/app-user-account-public-rail";
import { AppUserApprovedHeader } from "@/app/ui/app_user-approved-header";
import { GlobalFooter } from "@/app/ui/global-footer";
import { StarfieldBackground } from "@/app/ui/starfield-background";
import { XchatGuestHeader } from "@/app/ui/xchat-guest-header";
import { MarketVeilBackground } from "@/components/animations/MarketVeilBackground";
import { getSessionUser, isSafeOAuthReturnPath, readPendingXLinkCookie } from "@/lib/auth";
import { isGoogleOAuthConfigured } from "@/lib/env";
import { normalizeMongoObjectIdParam } from "@/lib/mongo-object-id-hex";
import { oauthAuthErrorMessages } from "@/lib/oauth-auth-error-messages";
import { getWorkspaceTenantHeaderContext } from "@/lib/workspace-tenant-header";
import { canUserLogin } from "@/modules/identity/authorization";

import { XchatGuestPanel } from "./ui/xchat-guest-panel";
import { XchatGuestReadonlyShell } from "./ui/xchat-guest-readonly-shell";
import { XchatRouteSkeleton } from "./ui/xchat-route-skeleton";
import { XchatApprovedShell } from "./xchat-approved-shell";

type XchatPageProps = {
  searchParams: Promise<{
    error?: string;
    details?: string;
    rail?: string;
    item?: string;
    /** Post-login / OAuth return path (e.g. `/watchlist?portfolioId=…`). */
    next?: string;
    /** Align xChat workspace + ask payload with `/watchlist?portfolioId=` when present. */
    portfolioId?: string | string[];
    /** Optional custodian account for workspace rail pickers (Portfolio desk deep link). */
    accountId?: string | string[];
  }>;
};

export default async function XchatPage({ searchParams }: XchatPageProps) {
  const params = await searchParams;
  const authError = typeof params.error === "string" ? params.error : undefined;
  const authDetails = typeof params.details === "string" ? params.details : undefined;
  const nextRaw = typeof params.next === "string" ? params.next.trim() : "";
  const oauthReturnPath = nextRaw && isSafeOAuthReturnPath(nextRaw) ? nextRaw : null;
  const rail = typeof params.rail === "string" ? params.rail : "";
  const item = typeof params.item === "string" ? params.item : "";
  const initialXchatItem =
    rail === "xchat" &&
    (item === "composer" ||
      item === "persona" ||
      item === "examples" ||
      item === "example-prompts" ||
      item === "history" ||
      item === "attachments")
      ? item
      : null;
  const pendingXHandle =
    authError === "email_link_required"
      ? (await readPendingXLinkCookie())?.username
      : undefined;

  const rawPortfolioParam = params.portfolioId;
  const requestedPortfolioIdRaw =
    typeof rawPortfolioParam === "string"
      ? rawPortfolioParam.trim()
      : Array.isArray(rawPortfolioParam)
        ? rawPortfolioParam[0]?.trim() ?? ""
        : "";
  const requestedPortfolioId = requestedPortfolioIdRaw
    ? normalizeMongoObjectIdParam(requestedPortfolioIdRaw)
    : "";

  const rawAccountParam = params.accountId;
  const requestedAccountIdRaw =
    typeof rawAccountParam === "string"
      ? rawAccountParam.trim()
      : Array.isArray(rawAccountParam)
        ? rawAccountParam[0]?.trim() ?? ""
        : "";
  const requestedAccountId = requestedAccountIdRaw
    ? normalizeMongoObjectIdParam(requestedAccountIdRaw)
    : "";

  const googleLoginHrefGuest = isGoogleOAuthConfigured()
    ? `/api/auth/google/login?next=${encodeURIComponent(oauthReturnPath ?? "/xchat")}`
    : null;
  const xOAuthLoginHref =
    oauthReturnPath != null
      ? `/api/auth/x/login?next=${encodeURIComponent(oauthReturnPath)}`
      : "/api/auth/x/login?next=%2Fxchat";
  const emailPasswordLoginHref =
    oauthReturnPath != null
      ? `/login?next=${encodeURIComponent(oauthReturnPath)}`
      : "/login?next=%2Fxchat";

  const session = await getSessionUser();

  if (!session) {
    return (
      <div className="xchat-shell flex min-h-0 flex-col overflow-hidden">
        <StarfieldBackground />
        <div className="workspace-product-sticky-top sticky top-0 z-50 flex shrink-0 flex-col bg-[var(--xf-bg-800)]">
          <XchatGuestHeader />
        </div>
        <div className="xchat-body flex min-h-0 flex-1 flex-col overflow-hidden">
          <XchatGuestReadonlyShell
            mainFooter={<GlobalFooter />}
            showAccessPanel={false}
            workspaceProductGrid
            workspaceProductShellClassName="min-h-0 flex-1 overflow-hidden"
          >
            <XchatGuestPanel
              authDetails={authDetails}
              authError={authError}
              emailPasswordLoginHref={emailPasswordLoginHref}
              googleLoginHref={googleLoginHrefGuest}
              pendingXHandle={pendingXHandle}
              xOAuthLoginHref={xOAuthLoginHref}
            />
          </XchatGuestReadonlyShell>
        </div>
      </div>
    );
  }

  const approved = canUserLogin(session.roles);
  const workspaceTenant = approved ? await getWorkspaceTenantHeaderContext(session.tenantId) : null;
  const ambientVeilEnabled = approved ? (workspaceTenant?.ambientMarketVeilEnabled ?? true) : false;

  const pendingWorkspaceRail = !approved
    ? await AppUserAccountPublicRailForSession({
        feedbackPageLabel: "xChat",
        railVariant: "workspace-product",
        session
      })
    : null;

  const oauthLinkBannerMessage =
    approved && authError && oauthAuthErrorMessages[authError]
      ? oauthAuthErrorMessages[authError]
      : null;
  return (
    <div className="xchat-shell flex min-h-0 flex-col overflow-hidden">
      <StarfieldBackground />
      {ambientVeilEnabled ? <MarketVeilBackground /> : null}
      {approved ? (
        <div className="workspace-product-sticky-top sticky top-0 z-50 flex shrink-0 flex-col bg-[var(--xf-bg-800)]">
          <div className="workspace-product-approved-header-slot">
            <AppUserApprovedHeader
              current="xchat"
              feedbackPageLabel="xChat"
              session={session}
              workspaceTenant={workspaceTenant}
            />
          </div>
        </div>
      ) : (
        <div className="workspace-product-sticky-top sticky top-0 z-50 flex shrink-0 flex-col bg-[var(--xf-bg-800)]">
          <XchatGuestHeader />
        </div>
      )}

      <div className="xchat-body flex min-h-0 flex-1 flex-col overflow-hidden">
        {oauthLinkBannerMessage ? (
          <p
            className="xchat-oauth-inline-alert shrink-0"
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
          <Suspense fallback={<XchatRouteSkeleton />}>
            <XchatApprovedShell
              initialXchatItem={initialXchatItem}
              requestedAccountId={requestedAccountId}
              requestedPortfolioId={requestedPortfolioId}
              session={session}
            />
          </Suspense>
        ) : (
          <XchatGuestReadonlyShell
            mainFooter={<GlobalFooter />}
            rail={pendingWorkspaceRail ?? undefined}
            showAccessPanel={false}
            workspaceProductShellClassName="min-h-0 flex-1 overflow-hidden"
          >
            <XchatGuestPanel
              authDetails={authDetails}
              authError={authError}
              emailPasswordLoginHref={emailPasswordLoginHref}
              googleLoginHref={googleLoginHrefGuest}
              pendingApproval
              pendingXHandle={pendingXHandle}
              userEmail={session.email}
              xOAuthLoginHref={xOAuthLoginHref}
            />
          </XchatGuestReadonlyShell>
        )}
      </div>
    </div>
  );
}
