import { redirect } from "next/navigation";

import { getSessionUser } from "@/lib/auth";
import { isGlobalAdmin } from "@/modules/identity/authorization";

import { AdminPortfolioAlertsConsole } from "../../ui/admin-portfolio-alerts-console";

type PageProps = {
  params: Promise<{ portfolioId: string }>;
};

export default async function AdminPortfolioAlertsPage({ params }: PageProps) {
  const session = await getSessionUser();
  if (!session) {
    redirect("/login");
  }
  if (!isGlobalAdmin(session.roles)) {
    redirect("/admin?error=forbidden");
  }
  const { portfolioId } = await params;
  return <AdminPortfolioAlertsConsole portfolioId={portfolioId} />;
}
