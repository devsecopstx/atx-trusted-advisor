/** Canonical shared xAI Finance KB for all tenants (options + finance narratives). */
export const XAI_FINANCE_COLLECTION_ID_DEFAULT = "collection_b75e188e-e7e6-4aa8-8e01-23caf0946236";

export const XAI_FINANCE_COLLECTION_DISPLAY_NAME = "Finance";

/**
 * Resolved Finance collection id for RAG / file_search. Uses `XAI_FINANCE_COLLECTION_ID` when set;
 * otherwise the shipped default team Finance collection.
 */
export function getXaiFinanceCollectionId(): string {
  const raw = process.env.XAI_FINANCE_COLLECTION_ID?.trim();
  return raw && raw.length > 0 ? raw : XAI_FINANCE_COLLECTION_ID_DEFAULT;
}
