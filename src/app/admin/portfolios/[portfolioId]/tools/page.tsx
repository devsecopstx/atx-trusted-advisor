import { redirect } from "next/navigation";

import { getSessionUser } from "@/lib/auth";
import { isGlobalAdmin } from "@/modules/identity/authorization";

import { AdminPortfolioToolsHub } from "../../ui/admin-portfolio-tools-hub";

type PageProps = {
  params: Promise<{ portfolioId: string }>;
};

export default async function AdminPortfolioToolsPage({ params }: PageProps) {
  const session = await getSessionUser();
  if (!session) {
    redirect("/login");
  }
  if (!isGlobalAdmin(session.roles)) {
    redirect("/admin?error=forbidden");
  }
  const { portfolioId } = await params;
  return <AdminPortfolioToolsHub portfolioId={portfolioId} />;
}
