import { redirect } from "next/navigation";

import { getSessionUser } from "@/lib/auth";
import { isGlobalAdmin } from "@/modules/identity/authorization";

import { AdminPortfolioEmailPreferences } from "../../ui/admin-portfolio-email-preferences";

type PageProps = {
  params: Promise<{ portfolioId: string }>;
};

export default async function AdminPortfolioEmailPreferencesPage({ params }: PageProps) {
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
      <section className="hero-card xf-noise-overlay">
        <p className="eyebrow">atxfinance core admin</p>
        <h1 className="hero-title">Portfolio email preferences</h1>
        <p className="hero-copy">
          Toggle digest delivery and (optionally) override subject, body, and cadence on top of the
          tenant or global default. Empty override fields fall through to the resolved template.
        </p>
      </section>
      <AdminPortfolioEmailPreferences portfolioId={portfolioId} />
    </div>
  );
}
