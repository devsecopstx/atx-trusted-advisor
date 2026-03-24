import { redirect } from "next/navigation";

import { getSessionUser } from "@/lib/auth";
import { isGlobalAdmin } from "@/modules/identity/authorization";

import { AdminPortfolioAccountsConsole } from "../../ui/admin-portfolio-accounts-console";

type PageProps = {
  params: Promise<{ portfolioId: string }>;
};

export default async function AdminPortfolioAccountsPage({ params }: PageProps) {
  const session = await getSessionUser();
  if (!session) {
    redirect("/login");
  }
  if (!isGlobalAdmin(session.roles)) {
    redirect("/admin?error=forbidden");
  }
  const { portfolioId } = await params;
  return (
    <div className="core-shell">
      <AdminPortfolioAccountsConsole portfolioId={portfolioId} />
    </div>
  );
}
