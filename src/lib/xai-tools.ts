/**
 * Personas may store batch-style `collections_search` tools; xAI chat/responses
 * expects `file_search` with `source.collection_ids` (see xAI collections docs).
 */
export function toXaiRequestTools(tools: Array<Record<string, unknown>>): Array<Record<string, unknown>> {
  return tools.map((tool) => {
    const type = tool.type;
    if (type === "collections_search") {
      const ids = tool.collection_ids;
      const collectionIds = Array.isArray(ids)
        ? ids.filter((id): id is string => typeof id === "string" && id.trim().length > 0)
        : [];
      if (collectionIds.length === 0) {
        return { type: "file_search" };
      }
      return { type: "file_search", source: { collection_ids: collectionIds } };
    }
    return { ...tool };
  });
}
