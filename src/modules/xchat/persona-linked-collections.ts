import {
    normalizePersonaXapiConfig,
    type PersonaXapiConfig,
    type PersonaXapiToolDefinition
} from "@/modules/xchat/types";

/** Admin/API list shapes may use loose `xapi.tools` typing; values are normalized before use. */
export type PersonaLinkedIdSource = {
  xaiCollection?: { collectionId?: string; collectionName?: string };
  xapi?: unknown;
};

/** Union of `xaiCollection.collectionId` plus any `collection_ids` on `file_search` / `collections_search` tools (normalized config). */
export function collectionIdsDeclaredOnPersona(
  persona: PersonaLinkedIdSource | null | undefined,
  xapi: PersonaXapiConfig
): string[] {
  const ids: string[] = [];
  const bound = persona?.xaiCollection?.collectionId?.trim();
  if (bound) {
    ids.push(bound);
  }
  for (const tool of xapi.tools) {
    if (tool.type === "collections_search" && Array.isArray(tool.collection_ids)) {
      for (const id of tool.collection_ids) {
        if (typeof id === "string" && id.trim()) {
          ids.push(id.trim());
        }
      }
    }
    if (tool.type === "file_search") {
      const source = (tool.source ?? {}) as Record<string, unknown>;
      if (Array.isArray(source.collection_ids)) {
        for (const id of source.collection_ids) {
          if (typeof id === "string" && id.trim()) {
            ids.push(id.trim());
          }
        }
      }
    }
  }
  return Array.from(new Set(ids));
}

/** Admin/UI helper: same id union as ask/batch after normalizing `xapi`. */
export function getPersonaLinkedCollectionIds(
  persona: PersonaLinkedIdSource | null | undefined
): string[] {
  const xapi = normalizePersonaXapiConfig(
    (persona?.xapi ?? null) as Partial<PersonaXapiConfig> | null | undefined
  );
  return collectionIdsDeclaredOnPersona(persona, xapi);
}

export function countPersonaLinkedCollections(
  persona: PersonaLinkedIdSource | null | undefined
): number {
  return getPersonaLinkedCollectionIds(persona).length;
}

export function withLinkedCollectionTools(
  config: PersonaXapiConfig,
  linkedCollectionIds: string[]
): PersonaXapiConfig {
  if (linkedCollectionIds.length === 0) {
    return config;
  }
  return {
    ...config,
    tools: config.tools.map((tool) => mergeCollectionIdsIntoTool(tool, linkedCollectionIds))
  };
}

function mergeCollectionIdsIntoTool(
  tool: PersonaXapiToolDefinition,
  linkedCollectionIds: string[]
): PersonaXapiToolDefinition {
  if (tool.type === "file_search") {
    const source = (tool.source ?? {}) as Record<string, unknown>;
    const existingIds = Array.isArray(source.collection_ids)
      ? source.collection_ids
          .filter((id): id is string => typeof id === "string")
          .map((id) => id.trim())
          .filter((id) => id.length > 0)
      : [];
    return {
      ...tool,
      source: {
        ...source,
        collection_ids: Array.from(new Set([...existingIds, ...linkedCollectionIds]))
      }
    };
  }

  if (tool.type === "collections_search") {
    const existingIds = Array.isArray(tool.collection_ids)
      ? tool.collection_ids
          .filter((id): id is string => typeof id === "string")
          .map((id) => id.trim())
          .filter((id) => id.length > 0)
      : [];
    return {
      ...tool,
      collection_ids: Array.from(new Set([...existingIds, ...linkedCollectionIds]))
    };
  }

  return tool;
}
