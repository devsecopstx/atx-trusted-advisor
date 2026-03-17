"use client";

import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";

import { parseJson } from "@/app/admin/ui/http";

export function CollectionEditorPage() {
  const [collectionName, setCollectionName] = useState("");
  const [status, setStatus] = useState("Ready");
  const router = useRouter();

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const normalizedName = collectionName.trim();
    if (!normalizedName) {
      setStatus("Collection name is required");
      return;
    }
    setStatus("Creating collection...");
    try {
      await parseJson(
        await fetch("/api/personas/collections", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: normalizedName })
        })
      );
      router.push("/admin/personas");
      router.refresh();
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Failed to create collection");
    }
  }

  return (
    <section className="panel stack-gap">
      <article className="surface-card xf-widget section-card">
        <h3>Create Collection</h3>
        <p className="status-text">{status}</p>
        <form className="stack-form" onSubmit={onSubmit}>
          <input
            onChange={(event) => setCollectionName(event.target.value)}
            placeholder="collection name"
            required
            value={collectionName}
          />
          <div className="tool-row">
            <button className="cta cta-primary" type="submit">
              Create collection
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
