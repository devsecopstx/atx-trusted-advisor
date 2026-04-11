import { ObjectId } from "mongodb";

import type { WorkspaceProductSidebarProps } from "@/app/ui/workspace-product-sidebar";
import { loadAppUserDefaultBook } from "@/lib/app-user-default-book";
import type { SessionUser } from "@/lib/auth";
import { getMongoConnectionLabel, shouldShowAppUserDbLabel } from "@/lib/env";
import { normalizeSubscriptionPlan } from "@/lib/subscription-plan";
import { isGlobalAdmin } from "@/modules/identity/authorization";
import { getCoreUserById } from "@/modules/identity/repository";

export type WorkspaceProductSidebarServerProps = Pick<
  WorkspaceProductSidebarProps,
  | "accountDetails"
  | "accountFeedbackPageLabel"
  | "defaultPortfolioId"
  | "isGlobalAdmin"
  | "showReferenceDocs"
  | "workspaceBook"
>;

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
    workspaceBook: book
  };
}
