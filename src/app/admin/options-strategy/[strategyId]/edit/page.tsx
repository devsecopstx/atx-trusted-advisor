import Link from "next/link";
import { redirect } from "next/navigation";

import { getSessionUser } from "@/lib/auth";
import { isGlobalAdmin } from "@/modules/identity/authorization";

import { OptionsStrategyEditor } from "../../ui/options-strategy-editor";

type PageProps = {
  params: Promise<{ strategyId: string }>;
};

export default async function EditOptionsStrategyPage({ params }: PageProps) {
  const session = await getSessionUser();
  if (!session) {
    redirect("/login");
  }
  if (!isGlobalAdmin(session.roles)) {
    redirect("/admin?error=forbidden");
  }

  const { strategyId } = await params;

  return (
    <div className="core-shell">
      <section className="hero-card xf-noise-overlay">
        <p className="eyebrow">
          <Link className="text-emerald-400 hover:underline" href="/admin/options-strategy">
            Options strategy
          </Link>
          <span aria-hidden> · </span>
          <span>Edit</span>
        </p>
        <h1 className="hero-title">Edit strategy</h1>
        <p className="hero-copy">Update display name, strategy markdown, and free-form filters JSON.</p>
      </section>

      <OptionsStrategyEditor strategyId={strategyId} />
    </div>
  );
}
