import Link from "next/link";
import { redirect } from "next/navigation";

import { getSessionUser } from "@/lib/auth";
import { listPersonas } from "@/modules/xchat/repository";

export default async function PersonasReadOnlyPage() {
  const session = await getSessionUser();
  if (!session) {
    redirect("/login");
  }

  const personas = await listPersonas();

  return (
    <main className="core-shell">
      <section className="hero-card xf-noise-overlay">
        <div className="hero-top">
          <div>
            <p className="eyebrow">xfinance core</p>
            <h1 className="hero-title">xPersona Directory</h1>
            <p className="hero-copy">Read-only list of available xPersona profiles.</p>
          </div>
          <div className="cta-row">
            <Link className="cta cta-secondary" href="/admin">
              Back to admin
            </Link>
          </div>
        </div>
      </section>

      <section className="panel">
        <header className="panel-header">
          <h2>Available Personas</h2>
          <p>{personas.length} configured</p>
        </header>
        <div className="surface-grid">
          {personas.map((persona) => (
            <article
              className="surface-card xf-widget section-card"
              key={persona._id?.toHexString() ?? persona.name}
            >
              <h3>{persona.name}</h3>
              <p>Model: {persona.model}</p>
              <p>Scope: {persona.defaultScope}</p>
              <p>RAG: {persona.enableRag ? "enabled" : "disabled"}</p>
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}
