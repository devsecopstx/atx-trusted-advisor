import { ObjectId } from "mongodb";

import type { WorkspaceProductSidebarProps } from "@/app/ui/workspace-product-sidebar";
import { loadAppUserDefaultBook } from "@/lib/app-user-default-book";
import type { SessionUser } from "@/lib/auth";
import { getMongoConnectionLabel, shouldShowAppUserDbLabel } from "@/lib/env";
import { normalizeSubscriptionPlan } from "@/lib/subscription-plan";
import { isGlobalAdmin } from "@/modules/identity/authorization";
import { getCoreUserById, getTenantByHexId } from "@/modules/identity/repository";
import {
    listVisiblePrefixPathsForRole,
    type AppUserRouteVisibilityOverrides,
    type PlatformRoleForRoutes
} from "@/modules/platform/app-user-route-catalog";

export type WorkspaceProductSidebarServerProps = Pick<
  WorkspaceProductSidebarProps,
  | "accountDetails"
  | "accountFeedbackPageLabel"
  | "defaultPortfolioId"
  | "isGlobalAdmin"
  | "showReferenceDocs"
  | "visiblePathPrefixes"
  | "workspaceBook"
>;

function resolvePlatformRoleForRoutes(session: SessionUser): PlatformRoleForRoutes {
  if (isGlobalAdmin(session.roles)) {
    return "global_admin";
  }
  if (session.roles.includes("advisor")) {
    return "advisor";
  }
  if (session.roles.includes("operator")) {
    return "operator";
  }
  return "viewer";
}

function parseRouteVisibilityOverrides(raw: unknown): AppUserRouteVisibilityOverrides {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return {};
  }
  const out: AppUserRouteVisibilityOverrides = {};
  for (const [routeId, value] of Object.entries(raw)) {
    if (typeof value === "boolean") {
      out[routeId] = value;
    }
  }
  return out;
}

/**
 * Serializable props for {@link WorkspaceProductSidebar} from a session (server).
 * Use when passing the sidebar through `AppUserCollapsibleRailLayout`'s `rail` prop so the slot is a
 * client component + plain props (async Server Components in that slot are unreliable).
 */
export async function getWorkspaceProductSidebarPropsForSession(
  session: SessionUser,
  accountFeedbackPageLabel?: string
): Promise<WorkspaceProductSidebarServerProps> {
  const book = await loadAppUserDefaultBook(session);
  const mongoConnection = shouldShowAppUserDbLabel() ? getMongoConnectionLabel() : "";
  const admin = isGlobalAdmin(session.roles);
  const workspacePortfolioId = book?.portfolioId?.trim() ? book.portfolioId.trim() : null;

  let subscriptionPlan = normalizeSubscriptionPlan(undefined);
  if (ObjectId.isValid(session.userId)) {
    const user = await getCoreUserById(new ObjectId(session.userId));
    subscriptionPlan = normalizeSubscriptionPlan(user?.subscriptionPlan);
  }
  const tenant = session.tenantId?.trim() ? await getTenantByHexId(session.tenantId.trim()) : null;
  const routeOverrides = parseRouteVisibilityOverrides(
    tenant?.tenantPreferences?.app_user_route_visibility_overrides
  );
  const visiblePathPrefixes = listVisiblePrefixPathsForRole(
    resolvePlatformRoleForRoutes(session),
    routeOverrides
  );

  return {
    accountDetails: {
      email: session.email,
      username: session.username,
      displayName: session.displayName,
      xUserId: session.xUserId,
      avatarUrl: session.avatarUrl,
      mongoConnection,
      tenantIdHex: session.tenantId?.trim() || undefined,
      subscriptionPlan,
      isGlobalAdmin: admin
    },
    accountFeedbackPageLabel,
    defaultPortfolioId: workspacePortfolioId,
    isGlobalAdmin: admin,
    showReferenceDocs: true,
    visiblePathPrefixes,
    workspaceBook: book
  };
}
