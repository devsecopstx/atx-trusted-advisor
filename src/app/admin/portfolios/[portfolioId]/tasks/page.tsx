import { redirect } from "next/navigation";

import { getSessionUser } from "@/lib/auth";
import { isGlobalAdmin } from "@/modules/identity/authorization";

import { AdminPortfolioTasksConsole } from "../../ui/admin-portfolio-tasks-console";

type PageProps = {
  params: Promise<{ portfolioId: string }>;
};

export default async function AdminPortfolioTasksPage({ params }: PageProps) {
  const session = await getSessionUser();
  if (!session) {
    redirect("/login");
  }
  if (!isGlobalAdmin(session.roles)) {
    redirect("/admin?error=forbidden");
  }
  const { portfolioId } = await params;
  return <AdminPortfolioTasksConsole portfolioId={portfolioId} />;
}
