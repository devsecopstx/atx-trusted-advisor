import { ObjectId } from "mongodb";
import { redirect } from "next/navigation";

import { getSessionUser } from "@/lib/auth";
import { isGlobalAdmin } from "@/modules/identity/authorization";

import { AdminRiskOutlookPreferences } from "../ui/admin-risk-outlook-preferences";

type PageProps = {
  searchParams: Promise<{ userId?: string; portfolioId?: string }>;
};

export default async function AdminManageAccountPage({ searchParams }: PageProps) {
  const session = await getSessionUser();
  if (!session) {
    redirect("/login");
  }
  if (!isGlobalAdmin(session.roles)) {
    redirect("/admin?error=forbidden");
  }

  const sp = await searchParams;
  const userId = (sp.userId ?? "").trim();
  if (!userId || !ObjectId.isValid(userId)) {
    redirect("/admin/portfolios");
  }

  const portfolioId = (sp.portfolioId ?? "").trim();

  return (
    <div className="core-shell stack-gap">
      <section className="hero-card xf-noise-overlay">
        <p className="eyebrow">atxfinance core admin</p>
        <h1 className="hero-title">Manage account</h1>
        <p className="hero-copy">
          Set <strong>risk level</strong> and <strong>investment strategy</strong> for the portfolio owner&apos;s
          workspace. Values persist on the user&apos;s admin settings record.
        </p>
      </section>

      <AdminRiskOutlookPreferences
        portfolioId={portfolioId && ObjectId.isValid(portfolioId) ? portfolioId : undefined}
        userId={userId}
        variant="page"
      />
    </div>
  );
}
