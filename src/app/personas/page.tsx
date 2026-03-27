import Link from "next/link";
import { redirect } from "next/navigation";

import { BackIcon } from "@/app/admin/ui/crud-icons";
import { AtxFinanceLogo } from "@/app/ui/atxfinance-logo";
import { getSessionUser } from "@/lib/auth";

import { PersonaDirectory } from "./ui/persona-directory";

export default async function PersonasPage() {
  const session = await getSessionUser();
  if (!session) {
    redirect("/login");
  }

  return (
    <main className="core-shell">
      <section className="hero-card xf-noise-overlay">
        <AtxFinanceLogo size="sm" />
        <h1 className="hero-title">xPersona Directory</h1>
        <p className="hero-copy">
          Read-only directory of configured xPersonas and their capabilities.
        </p>
        <div className="cta-row">
          <Link className="cta cta-secondary" href="/admin">
            <BackIcon className="crud-icon" />
            Back to admin
          </Link>
        </div>
      </section>

      <PersonaDirectory />
    </main>
  );
}
