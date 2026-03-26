import Link from "next/link";
import { redirect } from "next/navigation";

import { getSessionUser } from "@/lib/auth";
import { isGlobalAdmin } from "@/modules/identity/authorization";

import { OptionsStrategyConsole } from "./ui/options-strategy-console";

export default async function AdminOptionsStrategyPage() {
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
        <h1 className="hero-title">Options strategy (canonical)</h1>
        <p className="hero-copy">
          Seeded from <code className="font-mono text-xs">atx-rag-collection/options-strategy</code> when you run
          <code className="font-mono text-xs"> npm run seed:admin</code> (or
          <code className="font-mono text-xs"> npm run seed:options-strategy</code>). The <strong>name</strong> defaults to the
          markdown filename; the <strong>description</strong> is the full file body. You can also edit free-form
          <strong> filters</strong> JSON per strategy.
        </p>
        <p className="hero-copy" style={{ marginTop: "0.5rem" }}>
          <Link className="text-emerald-400 hover:underline" href="/admin">
            ← Hub
          </Link>
        </p>
      </section>

      <OptionsStrategyConsole />
    </div>
  );
}
