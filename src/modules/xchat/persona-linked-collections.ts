import {
    normalizePersonaXapiConfig,
    type PersonaXapiConfig,
    type PersonaXapiToolDefinition
} from "@/modules/xchat/types";

/** Admin/API list shapes may use loose `xapi.tools` typing; values are normalized before use. */
export type PersonaLinkedIdSource = {
  xaiCollection?: { collectionId?: string; collectionName?: string };
  teamCollection?: { collectionId?: string; collectionName?: string };
  xapi?: unknown;
  includeUserBootstrapCollection?: boolean;
};

/** Union of `xaiCollection.collectionId`, `teamCollection.collectionId`, plus any `collection_ids` on `file_search` / `collections_search` tools (normalized config). */
export function collectionIdsDeclaredOnPersona(
  persona: PersonaLinkedIdSource | null | undefined,
  xapi: PersonaXapiConfig
): string[] {
  const ids: string[] = [];
  const bound = persona?.xaiCollection?.collectionId?.trim();
  if (bound) {
    ids.push(bound);
  }
  const team = persona?.teamCollection?.collectionId?.trim();
  if (team) {
    ids.push(team);
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

/**
 * Persona-declared ids + optional session user bootstrap id when `includeUserBootstrapCollection` is true.
 * Use for `POST /api/xchat/ask`, batch, and multi-source gather (same union as `withLinkedCollectionTools`).
 */
export function resolveXchatLinkedCollectionIds(input: {
  persona: PersonaLinkedIdSource | null | undefined;
  userBootstrapCollectionId?: string | null;
}): string[] {
  const base = getPersonaLinkedCollectionIds(input.persona);
  const includeUser = input.persona?.includeUserBootstrapCollection === true;
  const uid = input.userBootstrapCollectionId?.trim();
  if (includeUser && uid) {
    return Array.from(new Set([...base, uid]));
  }
  return base;
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
