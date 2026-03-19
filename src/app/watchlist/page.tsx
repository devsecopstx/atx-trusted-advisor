import Link from "next/link";
import { redirect } from "next/navigation";

import { AppUserApprovedHeader } from "@/app/ui/app-user-approved-header";
import { getSessionUser } from "@/lib/auth";
import { canUserLogin, isGlobalAdmin } from "@/modules/identity/authorization";

import "../xchat/xchat.css";

export default async function WatchlistPage() {
  const session = await getSessionUser();
  if (!session) {
    redirect("/login?next=/watchlist");
  }

  if (!canUserLogin(session.roles)) {
    redirect("/xchat");
  }

  const admin = isGlobalAdmin(session.roles);

  return (
    <div className="xchat-shell">
      <AppUserApprovedHeader current="watchlist" feedbackPageLabel="Watchlist" session={session} />

      <div className="xchat-body" style={{ padding: "1rem" }}>
        <section className="hero-card xf-noise-overlay" style={{ maxWidth: "640px", margin: "0 auto" }}>
          <p className="eyebrow">Watchlist</p>
          <h1 className="hero-title">Symbols & alerts</h1>
          <p className="hero-copy">
            App-user watchlist UI will live here (linked to your default portfolio context). Stub until the
            execution surface ships.
          </p>
          <div className="cta-row" style={{ marginTop: "1.25rem" }}>
            <Link className="cta cta-secondary" href="/xfinance">
              Back to portfolio
            </Link>
            {admin ? (
              <Link className="cta cta-primary" href="/admin/portfolios">
                Open in admin console
              </Link>
            ) : null}
          </div>
        </section>
      </div>
    </div>
  );
}
