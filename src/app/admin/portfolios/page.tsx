import { redirect } from "next/navigation";

import { getSessionUser } from "@/lib/auth";

import { PortfolioConsole } from "./ui/portfolio-console";

export default async function AdminPortfoliosPage() {
  const session = await getSessionUser();
  if (!session) {
    redirect("/login");
  }
  if (!session.roles.includes("global_admin")) {
    redirect("/admin?error=forbidden");
  }

  return (
    <div className="core-shell">
      <section className="hero-card xf-noise-overlay">
        <p className="eyebrow">atxfinance core admin</p>
        <h1 className="hero-title">Portfolios</h1>
        <p className="hero-copy">
          View default portfolio, accounts, and watchlist for the current admin session.
        </p>
      </section>

      <PortfolioConsole />
    </div>
  );
}
