import { redirect } from "next/navigation";

import { getSessionUser } from "@/lib/auth";
import { isGlobalAdmin } from "@/modules/identity/authorization";

type PageProps = {
  params: Promise<{ portfolioId: string }>;
};

/** @deprecated Use `/admin/accounts/[portfolioId]`. */
export default async function AdminPortfolioAccountsRedirect({ params }: PageProps) {
  const session = await getSessionUser();
  if (!session) {
    redirect("/login");
  }
  if (!isGlobalAdmin(session.roles)) {
    redirect("/admin?error=forbidden");
  }
  const { portfolioId } = await params;
  redirect(`/admin/accounts/${encodeURIComponent(portfolioId)}`);
}
