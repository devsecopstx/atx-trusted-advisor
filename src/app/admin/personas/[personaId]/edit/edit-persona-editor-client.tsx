"use client";

import dynamic from "next/dynamic";

/** `ssr: false` must live in a Client Component (not in Server `page.tsx`). */
const PersonaEditorPage = dynamic(
  () => import("../../ui/persona-editor-page").then((mod) => mod.PersonaEditorPage),
  {
    ssr: false,
    loading: () => (
      <section className="panel stack-gap">
        <article className="surface-card xf-widget section-card">
          <h3>Edit Persona</h3>
          <p className="status-text">Loading editor…</p>
        </article>
      </section>
    )
  }
);

export function EditPersonaEditorClient({ personaId }: { personaId: string }) {
  return <PersonaEditorPage mode="edit" personaId={personaId} />;
}
