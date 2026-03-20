import { redirect } from "next/navigation";

import { getSessionUser } from "@/lib/auth";
import { getEnv } from "@/lib/env";
import { isGlobalAdmin } from "@/modules/identity/authorization";
import { MarketingHero } from "./ui/marketing-hero";
import "./ui/marketing-hero.css";
import "./ui/product-plans.css";
// apps/web/app/(app)/xfinance/page.tsx  ← or wherever you want the landing
export default function XFinanceHero() {
  return (
    <div className="min-h-screen bg-[#050505] text-white flex items-center justify-center relative overflow-hidden">
      <div className="absolute inset-0 bg-[radial-gradient(#22c55e_0.8px,transparent_1px)] [background-size:30px_30px] opacity-10" />
      
      <div className="max-w-5xl text-center px-6 relative z-10">
        {/* Lightning Icon + xFinance (first screenshot style) */}
        <div className="flex items-center justify-center gap-4 mb-8">
          <div className="text-6xl">⚡</div>
          <div className="text-8xl font-black tracking-[-6px] text-white">xF</div>
        </div>

        <h1 className="font-black text-7xl md:text-8xl tracking-tighter">
          xFinance <span className="text-emerald-400">Coach</span>
        </h1>
        
        <p className="mt-6 text-4xl font-medium text-emerald-400">
          No Atoms Moved. Just Gains Earned.
        </p>
        
        <p className="mt-4 text-2xl text-slate-400 max-w-lg mx-auto">
          Cheapest xFinance on earth at <span className="text-emerald-400 font-bold">$2/hr</span>.<br />
          Unified options scanner • Covered calls • Protective puts • Real profits.
        </p>

        <div className="mt-12 flex flex-wrap justify-center gap-4">
          <button className="bg-emerald-400 hover:bg-emerald-500 text-black font-bold px-10 py-4 rounded-2xl text-xl transition-all active:scale-95">
            Start xChat — $2/hr
          </button>
          <button className="border border-slate-700 hover:bg-white/5 px-10 py-4 rounded-2xl text-xl transition-all">
            Watch xMoney Demo
          </button>
        </div>

        <div className="mt-16 flex justify-center gap-8 text-sm text-slate-500">
          <div>xFinance</div>
          <div>xChat</div>
          <div>xCoach</div>
          <div className="text-emerald-400">xMoney • coming soon</div>
        </div>
      </div>
    </div>
  );
}

export default async function HomePage() {
  const session = await getSessionUser();
  const adminSession = session ? isGlobalAdmin(session.roles) : false;

  if (session && !adminSession) {
    redirect("/xchat");
  }

  const env = getEnv();
  const oauthStatus =
    env.X_OAUTH_CLIENT_ID.trim().length > 0 && env.X_OAUTH_CLIENT_SECRET.trim().length > 0
      ? "configured"
      : "not configured";

  return (
    <>
      <MarketingHero isGlobalAdmin={adminSession} signedIn={Boolean(session)} />

      <div className="core-shell">
        <section className="panel">
          <header className="panel-header">
            <h2>Platform Status</h2>
            <p>Private dark-launch — approved access only.</p>
          </header>

          <div className="badge-wrap" style={{ marginBottom: "0.5rem" }}>
            <span className="status-badge status-live">API live</span>
            <span
              className={`status-badge ${oauthStatus === "configured" ? "status-ready" : "status-warn"}`}
            >
              X OAuth {oauthStatus}
            </span>
            <span className="status-badge">Dark Launch</span>
          </div>
        </section>
      </div>
    </>
  );
}
