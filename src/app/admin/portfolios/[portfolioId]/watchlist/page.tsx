import { redirect } from "next/navigation";

import { getSessionUser } from "@/lib/auth";
import { isGlobalAdmin } from "@/modules/identity/authorization";

import { WatchlistConsole } from "@/app/watchlist/ui/watchlist-console";

import "@/app/watchlist/watchlist.css";

type PageProps = {
  params: Promise<{ portfolioId: string }>;
};

export default async function AdminPortfolioWatchlistPage({ params }: PageProps) {
  const { portfolioId } = await params;
  const session = await getSessionUser();
  if (!session) {
    redirect(`/login?next=${encodeURIComponent(`/admin/portfolios/${portfolioId}/watchlist`)}`);
  }
  if (!isGlobalAdmin(session.roles)) {
    redirect("/admin?error=forbidden");
  }
  return (
    <div className="core-shell">
      <WatchlistConsole
        footerMode="admin"
        isAdmin
        portfolioId={portfolioId}
        watchlistApiPrefix="/api/admin/portfolios"
      />
    </div>
  );
}
