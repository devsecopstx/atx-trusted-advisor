"use client";

import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useState } from "react";

import { parseJson } from "@/app/admin/ui/http";

type CollectionBindingEditorPageProps = {
  collectionId: string;
};

type PersonaOption = {
  _id?: string;
  name: string;
  xaiCollection: {
    collectionId: string;
    collectionName?: string;
  };
};

export function CollectionBindingEditorPage({ collectionId }: CollectionBindingEditorPageProps) {
  const [personas, setPersonas] = useState<PersonaOption[]>([]);
  const [status, setStatus] = useState("Ready");
  const [personaId, setPersonaId] = useState("");
  const [collectionName, setCollectionName] = useState("");
  const router = useRouter();

  useEffect(() => {
    void (async () => {
      try {
        const payload = await parseJson<{ data: PersonaOption[] }>(await fetch("/api/personas"));
        setPersonas(payload.data);
        const firstPersonaId = payload.data.find((persona) => Boolean(persona._id))?._id ?? "";
        setPersonaId(firstPersonaId);
        setStatus("Loaded personas");
      } catch (error) {
        setStatus(error instanceof Error ? error.message : "Failed to load personas");
      }
    })();
  }, []);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!personaId) {
      setStatus("Choose a persona first");
      return;
    }
    setStatus("Assigning collection...");
    try {
      await parseJson(
        await fetch(`/api/personas/${personaId}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            xaiCollection: {
              collectionId,
              collectionName: collectionName.trim()
            }
          })
        })
      );
      router.push("/admin/personas");
      router.refresh();
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Failed to assign collection");
    }
  }

  return (
    <section className="panel stack-gap">
      <article className="surface-card xf-widget section-card">
        <h3>Edit Collection Usage</h3>
        <p className="status-text">Collection id: {collectionId}</p>
        <p className="status-text">{status}</p>
        <form className="stack-form" onSubmit={onSubmit}>
          <select onChange={(event) => setPersonaId(event.target.value)} value={personaId}>
            <option value="">Select persona</option>
            {personas.map((persona) =>
              persona._id ? (
                <option key={persona._id} value={persona._id}>
                  {persona.name}
                </option>
              ) : null
            )}
          </select>
          <input
            onChange={(event) => setCollectionName(event.target.value)}
            placeholder="optional collection display name"
            value={collectionName}
          />
          <div className="tool-row">
            <button className="cta cta-primary" type="submit">
              Save binding
            </button>
            <button className="cta cta-secondary" onClick={() => router.push("/admin/personas")} type="button">
              Cancel
            </button>
          </div>
        </form>
      </article>
    </section>
  );
}
