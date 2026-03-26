import Link from "next/link";
import { redirect } from "next/navigation";

import { getSessionUser } from "@/lib/auth";
import { isGlobalAdmin } from "@/modules/identity/authorization";

import { OptionsStrategyNewForm } from "../ui/options-strategy-new";

export default async function NewOptionsStrategyPage() {
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
        <p className="eyebrow">
          <Link className="text-emerald-400 hover:underline" href="/admin/options-strategy">
            Options strategy
          </Link>
          <span aria-hidden> · </span>
          <span>New</span>
        </p>
        <h1 className="hero-title">Create new strategy</h1>
        <p className="hero-copy">Provide slug, name, and initial markdown. You can also set filters JSON now or later.</p>
      </section>

      <OptionsStrategyNewForm />
    </div>
  );
}
