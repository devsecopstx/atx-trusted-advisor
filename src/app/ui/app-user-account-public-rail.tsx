import { loadAppUserDefaultBook } from "@/lib/app-user-default-book";
import { appUserPrimaryDisplayName } from "@/lib/app-user-primary-display-name";
import type { SessionUser } from "@/lib/auth";
import { getMongoConnectionLabel, shouldShowAppUserDbLabel } from "@/lib/env";
import { isGlobalAdmin } from "@/modules/identity/authorization";
import { listVisiblePrefixPathsForRole } from "@/modules/platform/app-user-route-catalog";
import { getTenantRoutePolicyForSession } from "@/modules/platform/tenant-route-policy";
import { resolveXoptionsEntitlements } from "@/modules/xoptions/entitlements";

import { AppUserAccountPublicRail } from "./app-user-rail-nav";
import { WorkspaceProductSidebar } from "./workspace-product-sidebar";

type AppUserAccountPublicRailForSessionProps = {
  session: SessionUser;
  /** Passed to feedback API as `page` when set; otherwise the account panel uses the current pathname. */
  feedbackPageLabel?: string;
  /** Uses the same top-level workspace sidebar shape as xChat/portfolios. */
  railVariant?: "legacy" | "workspace-product";
};

export async function AppUserAccountPublicRailForSession({
  session,
  feedbackPageLabel,
  railVariant = "legacy"
}: AppUserAccountPublicRailForSessionProps) {
  const book = await loadAppUserDefaultBook(session);
  const mongoConnection = shouldShowAppUserDbLabel() ? getMongoConnectionLabel() : "";
  const admin = isGlobalAdmin(session.roles);
  const entitlements = await resolveXoptionsEntitlements({
    userId: session.userId,
    roles: session.roles
  });
  const accountDetails = {
    email: session.email,
    username: session.username,
    displayName: session.displayName,
    xUserId: session.xUserId,
    avatarUrl: session.avatarUrl,
    mongoConnection,
    tenantIdHex: session.tenantId?.trim() || undefined,
    subscriptionPlan: entitlements.subscriptionPlan,
    isGlobalAdmin: admin
  };

  if (railVariant === "workspace-product") {
    const workspacePortfolioId = book?.portfolioId?.trim() ? book.portfolioId.trim() : null;
    const routePolicy = await getTenantRoutePolicyForSession(session);
    const visiblePathPrefixes = listVisiblePrefixPathsForRole(
      routePolicy.role,
      routePolicy.routeOverrides
    );
    return (
      <WorkspaceProductSidebar
        accountDetails={accountDetails}
        accountFeedbackPageLabel={feedbackPageLabel}
        defaultPortfolioId={workspacePortfolioId}
        isGlobalAdmin={admin}
        showReferenceDocs
        visiblePathPrefixes={visiblePathPrefixes}
        workspaceBook={book}
      />
    );
  }

  return (
    <AppUserAccountPublicRail
      accountDetails={accountDetails}
      accountFeedbackPageLabel={feedbackPageLabel}
      isGlobalAdmin={admin}
      railContext={{
        userDisplayName: appUserPrimaryDisplayName(session),
        book
      }}
    />
  );
}
