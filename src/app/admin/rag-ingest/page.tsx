import Link from "next/link";
import { redirect } from "next/navigation";

import { getSessionUser } from "@/lib/auth";
import { isGlobalAdmin } from "@/modules/identity/authorization";

import { RagIngestConsole } from "./ui/rag-ingest-console";

export default async function AdminRagIngestPage() {
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
        <p className="eyebrow">atxfinance core admin · AI & knowledge</p>
        <h1 className="hero-title">PDF → RAG ingest</h1>
        <p className="hero-copy">
          Upload desk PDFs, review pymupdf4llm markdown under{" "}
          <code className="font-mono text-xs">atx-docs/rag-collection/&lt;slug&gt;/</code>, edit metadata, then seed{" "}
          <strong>Mongo</strong> (<code className="font-mono text-xs">options_strategy</code>) and a dedicated xAI collection per
          slug (<code className="font-mono text-xs">xfinance-pdf-ingest-&lt;slug&gt;</code>) with tag field definitions. CLI:{" "}
          <code className="font-mono text-xs">npm run ingest:pdf -- --file=… --slug=… --title=…</code>
        </p>
        <p className="hero-copy" style={{ marginTop: "0.5rem" }}>
          <Link className="text-xf-nav-green transition-colors hover:text-xf-nav-green-hover hover:underline" href="/admin">
            ← Hub
          </Link>
          {" · "}
          <Link
            className="text-xf-nav-green transition-colors hover:text-xf-nav-green-hover hover:underline"
            href="/admin/rag-files"
          >
            RAG collections (xAI inventory)
          </Link>
        </p>
      </section>

      <RagIngestConsole />
    </div>
  );
}
