import { redirect } from "next/navigation";

import { getSessionUser } from "@/lib/auth";
import { isGlobalAdmin } from "@/modules/identity/authorization";

import { AdminPortfolioHoldingsConsole } from "../../../../ui/admin-portfolio-holdings-console";

type PageProps = {
  params: Promise<{ portfolioId: string; accountId: string }>;
};

export default async function AdminPortfolioAccountHoldingsPage({ params }: PageProps) {
  const session = await getSessionUser();
  if (!session) {
    redirect("/login");
  }
  if (!isGlobalAdmin(session.roles)) {
    redirect("/admin?error=forbidden");
  }
  const { portfolioId, accountId } = await params;
  return <AdminPortfolioHoldingsConsole portfolioId={portfolioId} accountId={accountId} />;
}
