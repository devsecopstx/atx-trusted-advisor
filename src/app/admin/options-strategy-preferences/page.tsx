import Link from "next/link";
import { redirect } from "next/navigation";

import { getSessionUser } from "@/lib/auth";
import { isGlobalAdmin } from "@/modules/identity/authorization";

import { OptionsStrategyPreferencesConsole } from "./ui/options-strategy-preferences-console";

export default async function AdminOptionsStrategyPreferencesPage() {
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
        <h1 className="hero-title">Options strategy preferences</h1>
        <p className="hero-copy">
          Defaults are loaded from <code className="font-mono text-xs">atx-docs/rag-collection/options-strategy</code> when you
          run <code className="font-mono text-xs">npm run seed:admin</code> (or{" "}
          <code className="font-mono text-xs">npm run seed:options-strategy-prefs</code>
          ). Each row is one strategy folder; the <strong>name</strong> comes from the markdown filename; the{" "}
          <strong>document</strong> is the full file body (markdown). Re-seed overwrites description and name from disk.
        </p>
        <p className="hero-copy" style={{ marginTop: "0.5rem" }}>
          <Link className="text-xf-nav-green transition-colors hover:text-xf-nav-green-hover hover:underline" href="/admin">
            ← Hub
          </Link>
        </p>
      </section>

      <OptionsStrategyPreferencesConsole />
    </div>
  );
}
