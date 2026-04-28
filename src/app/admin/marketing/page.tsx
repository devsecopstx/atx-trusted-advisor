import { redirect } from "next/navigation";

import { getSessionUser } from "@/lib/auth";
import { isGlobalAdmin } from "@/modules/identity/authorization";

import { MarketingConsole } from "./ui/marketing-console";

export default async function AdminMarketingPage() {
  const session = await getSessionUser();
  if (!session) {
    redirect("/login");
  }
  if (!isGlobalAdmin(session.roles)) {
    redirect("/admin?error=forbidden");
  }

  return (
    <div className="core-shell">
      <section className="hero-card xf-noise-overlay">
        <p className="eyebrow">atxfinance core admin</p>
        <h1 className="hero-title">Marketing Scheduler</h1>
        <p className="hero-copy">
          Configure recurring social posts, run posts immediately, and review delivery history from the same audited scheduler
          infrastructure used by Admin Tasks.
        </p>
      </section>
      <MarketingConsole />
    </div>
  );
}
