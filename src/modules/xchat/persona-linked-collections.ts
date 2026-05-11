import { getXaiFinanceCollectionId } from "@/lib/xai-finance-collection";
import { resolveTeamKbCollectionId } from "@/modules/xchat/team-xai-collection";
import {
    isAtxFunctionToolType,
    normalizePersonaXapiConfig,
    type PersonaXapiConfig,
    type PersonaXapiToolDefinition
} from "@/modules/xchat/types";

/** Admin/API list shapes may use loose `xapi.tools` typing; values are normalized before use. */
export type PersonaLinkedIdSource = {
  xaiCollection?: { collectionId?: string; collectionName?: string };
  teamCollection?: { collectionId?: string; collectionName?: string };
  /** Optional explicit extras beyond the canonical Finance KB. */
  collectionIds?: string[];
  xapi?: unknown;
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
  if (Array.isArray(persona?.collectionIds)) {
    for (const id of persona.collectionIds) {
      if (typeof id === "string" && id.trim()) {
        ids.push(id.trim());
      }
    }
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
 * Persona-declared ids only: `xaiCollection`, `teamCollection`, and tool `collection_ids` (admin/UI union).
 * Runtime xChat ask/batch/multi-source RAG uses {@link resolveXchatPersonaDeclaredCollectionIds} +
 * `withLinkedCollectionTools(..., "replace")` (no implicit deploy env KB merge).
 */
export function resolveXchatLinkedCollectionIds(input: {
  persona: PersonaLinkedIdSource | null | undefined;
}): string[] {
  return getPersonaLinkedCollectionIds(input.persona);
}

/** Cap collections wired to file_search / collections_search / pre-search. */
export const MAX_XCHAT_TEAM_KB_COLLECTION_IDS = 2;

/**
 * xChat runtime: **persona-linked collection ids only** (xaiCollection, teamCollection, tool-declared ids).
 * Does **not** merge `resolveTeamKbCollectionId()` — avoids injecting `collections_search` / RAG from env alone.
 */
export function resolveXchatPersonaDeclaredCollectionIds(
  persona: PersonaLinkedIdSource | null | undefined
): string[] {
  const financeId = getXaiFinanceCollectionId();
  const declared = getPersonaLinkedCollectionIds(persona);
  const extras = declared.filter((id) => id !== financeId);
  const unique = Array.from(new Set([financeId, ...extras]));
  return unique.slice(0, MAX_XCHAT_TEAM_KB_COLLECTION_IDS);
}

/**
 * Legacy: persona `teamCollection` plus deploy team default (`resolveTeamKbCollectionId` / `XAI_TEAM_ID`).
 * Prefer {@link resolveXchatPersonaDeclaredCollectionIds} for ask/batch/orchestrator.
 */
export async function resolveXchatTeamOnlyLinkedCollectionIds(
  persona: PersonaLinkedIdSource | null | undefined
): Promise<string[]> {
  const ids: string[] = [];
  const team = persona?.teamCollection?.collectionId?.trim();
  if (team) {
    ids.push(team);
  }
  const envTeam = await resolveTeamKbCollectionId();
  if (envTeam?.trim()) {
    ids.push(envTeam.trim());
  }
  const unique = Array.from(new Set(ids));
  return unique.slice(0, MAX_XCHAT_TEAM_KB_COLLECTION_IDS);
}

/** How `withLinkedCollectionTools` applies ids to `file_search` / `collections_search` tools. */
export type LinkedCollectionWireMode = "merge" | "replace";

export function withLinkedCollectionTools(
  config: PersonaXapiConfig,
  linkedCollectionIds: string[],
  wireMode: LinkedCollectionWireMode = "merge"
): PersonaXapiConfig {
  if (linkedCollectionIds.length === 0) {
    return config;
  }
  const hasCollectionTool = config.tools.some(
    (tool) => tool.type === "file_search" || tool.type === "collections_search"
  );
  const toolsWithCollection = hasCollectionTool
    ? config.tools
    : addCollectionToolInPreferredOrder(config.tools, linkedCollectionIds);
  return {
    ...config,
    tools: toolsWithCollection.map((tool) =>
      applyLinkedCollectionIdsToTool(tool, linkedCollectionIds, wireMode)
    )
  };
}

function addCollectionToolInPreferredOrder(
  tools: PersonaXapiToolDefinition[],
  linkedCollectionIds: string[]
): PersonaXapiToolDefinition[] {
  const collectionTool: PersonaXapiToolDefinition = {
    type: "collections_search",
    collection_ids: linkedCollectionIds
  };
  const atxIndex = tools.findIndex((tool) => isAtxFunctionToolType(tool.type));
  if (atxIndex === -1) {
    return [...tools, collectionTool];
  }
  return [...tools.slice(0, atxIndex + 1), collectionTool, ...tools.slice(atxIndex + 1)];
}

function applyLinkedCollectionIdsToTool(
  tool: PersonaXapiToolDefinition,
  linkedCollectionIds: string[],
  wireMode: LinkedCollectionWireMode
): PersonaXapiToolDefinition {
  if (tool.type === "file_search") {
    const source = (tool.source ?? {}) as Record<string, unknown>;
    const existingIds = Array.isArray(source.collection_ids)
      ? source.collection_ids
          .filter((id): id is string => typeof id === "string")
          .map((id) => id.trim())
          .filter((id) => id.length > 0)
      : [];
    const collection_ids =
      wireMode === "replace"
        ? [...linkedCollectionIds]
        : Array.from(new Set([...existingIds, ...linkedCollectionIds]));
    return {
      ...tool,
      source: {
        ...source,
        collection_ids
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
    const collection_ids =
      wireMode === "replace"
        ? [...linkedCollectionIds]
        : Array.from(new Set([...existingIds, ...linkedCollectionIds]));
    return {
      ...tool,
      collection_ids
    };
  }

  return tool;
}
