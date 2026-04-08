import type { WorkspaceProductSidebarProps } from "@/app/ui/workspace-product-sidebar";
import { loadAppUserDefaultBook } from "@/lib/app-user-default-book";
import type { SessionUser } from "@/lib/auth";
import { getMongoConnectionLabel, shouldShowAppUserDbLabel } from "@/lib/env";
import { isGlobalAdmin } from "@/modules/identity/authorization";

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

  return {
    accountDetails: {
      email: session.email,
      username: session.username,
      displayName: session.displayName,
      xUserId: session.xUserId,
      avatarUrl: session.avatarUrl,
      mongoConnection,
      tenantIdHex: session.tenantId?.trim() || undefined,
      isGlobalAdmin: admin
    },
    accountFeedbackPageLabel,
    defaultPortfolioId: workspacePortfolioId,
    isGlobalAdmin: admin,
    showReferenceDocs: true,
    workspaceBook: book
  };
}
