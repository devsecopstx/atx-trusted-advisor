import Link from "next/link";
import { redirect } from "next/navigation";

import { getSessionUser } from "@/lib/auth";
import { isGlobalAdmin } from "@/modules/identity/authorization";

import { OptionsStrategyPreferenceEditor } from "../../ui/options-strategy-preference-editor";

type PageProps = {
  params: Promise<{ preferenceId: string }>;
};

export default async function EditOptionsStrategyPreferencePage({ params }: PageProps) {
  const session = await getSessionUser();
  if (!session) {
    redirect("/login");
  }
  if (!isGlobalAdmin(session.roles)) {
    redirect("/admin?error=forbidden");
  }

  const { preferenceId } = await params;

  return (
    <div className="core-shell">
      <section className="hero-card xf-noise-overlay">
        <p className="eyebrow">
          <Link
            className="text-xf-nav-green transition-colors hover:text-xf-nav-green-hover hover:underline"
            href="/admin/options-strategy-preferences"
          >
            Options strategy preferences
          </Link>
          <span aria-hidden> · </span>
          <span>Edit</span>
        </p>
        <h1 className="hero-title">Edit strategy document</h1>
        <p className="hero-copy">
          Update display <strong>name</strong> and the full markdown <strong>document</strong>. Large bodies stay in a
          scrollable, collapsible panel similar to persona prompts.
        </p>
      </section>

      <OptionsStrategyPreferenceEditor preferenceId={preferenceId} />
    </div>
  );
}
