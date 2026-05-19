export type PdfIngestCapabilities = {
  /** POST multipart PDF ingest (Python pymupdf4llm). */
  pdfUpload: boolean;
  /** Write `atx-docs/rag-collection/<slug>/` on disk (ingest + manifest timestamps). */
  repoWrites: boolean;
};

/**
 * Production Cloud Run: read baked `atx-docs/rag-collection` from the image, sync xAI + Mongo,
 * persist operator metadata in `pdf_ingest_registry` — no repo commits from the admin UI.
 */
export function pdfIngestAllowsRepoWrites(): boolean {
  if (process.env.ATX_PDF_INGEST_ALLOW_REPO_WRITES?.trim() === "true") {
    return true;
  }
  if (process.env.ATX_PDF_INGEST_DISABLE_REPO_WRITES?.trim() === "true") {
    return false;
  }
  return process.env.NODE_ENV !== "production";
}

export function pdfIngestAllowsPythonUpload(): boolean {
  if (process.env.ATX_PDF_INGEST_ALLOW_PYTHON?.trim() === "true") {
    return true;
  }
  if (process.env.ATX_PDF_INGEST_DISABLE_PYTHON?.trim() === "true") {
    return false;
  }
  return pdfIngestAllowsRepoWrites();
}

export function getPdfIngestCapabilities(): PdfIngestCapabilities {
  const repoWrites = pdfIngestAllowsRepoWrites();
  return {
    repoWrites,
    pdfUpload: repoWrites && pdfIngestAllowsPythonUpload()
  };
}
