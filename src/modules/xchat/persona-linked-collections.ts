type XaiToolLike = { type: string; [key: string]: unknown };

export type PersonaCollectionLinkSource = {
  xaiCollection?: { collectionId?: string };
  xapi?: { tools?: XaiToolLike[] };
};

/**
 * Unique collection ids referenced by the persona binding and by file_search /
 * collections_search tools (collection_ids / source.collection_ids).
 */
export function getPersonaLinkedCollectionIds(persona: PersonaCollectionLinkSource): string[] {
  const ids = new Set<string>();
  const primary = persona.xaiCollection?.collectionId?.trim();
  if (primary) {
    ids.add(primary);
  }
  for (const tool of persona.xapi?.tools ?? []) {
    if (tool.type === "file_search") {
      const source = tool.source as { collection_ids?: unknown } | undefined;
      const list = source?.collection_ids;
      if (Array.isArray(list)) {
        for (const id of list) {
          if (typeof id === "string" && id.trim()) {
            ids.add(id.trim());
          }
        }
      }
    }
    if (tool.type === "collections_search") {
      const list = tool.collection_ids;
      if (Array.isArray(list)) {
        for (const id of list) {
          if (typeof id === "string" && id.trim()) {
            ids.add(id.trim());
          }
        }
      }
    }
  }
  return [...ids];
}

export function countPersonaLinkedCollections(persona: PersonaCollectionLinkSource): number {
  return getPersonaLinkedCollectionIds(persona).length;
}
