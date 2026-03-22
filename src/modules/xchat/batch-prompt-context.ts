import type { PersonaXapiToolDefinition } from "@/modules/xchat/types";

/**
 * Appends structured KB-style context for **batch items and interactive xChat ask**:
 * persona-linked collection ids (no env/global defaults) and the persona tool list.
 */
export function buildBatchUserPromptAugmentation(input: {
  tools: PersonaXapiToolDefinition[];
  linkedCollectionIds: string[];
  /** Session user bootstrap id when `includeUserBootstrapCollection` is true on the persona. */
  userBootstrapCollectionId?: string | null;
  includeUserBootstrapCollection?: boolean;
}): string {
  const toolLines = input.tools.map((tool) => describePersonaToolForKbPrompt(tool));
  const linked = input.linkedCollectionIds.filter((id) => id.trim().length > 0);
  const uid = input.userBootstrapCollectionId?.trim();
  const userLine =
    input.includeUserBootstrapCollection && uid
      ? `User bootstrap xAI collection (xPersona includeUserBootstrapCollection): ${uid}`
      : input.includeUserBootstrapCollection
        ? "User bootstrap xAI collection: enabled on persona but id not resolved for this session"
        : null;

  const lines = [
    "[Persona / KB metadata — xChat and batch; use when relevant; do not echo as the user]",
    linked.length > 0
      ? `Resolved xAI collection ids (persona team KB + tool ids + optional user bootstrap): ${linked.join(", ")}`
      : "Resolved xAI collection ids: (none — check xPersona xaiCollection, teamCollection, tools, includeUserBootstrapCollection)",
    ...(userLine ? [userLine] : []),
    "Persona xAPI tools (as configured in admin):",
    ...(toolLines.length > 0 ? toolLines : ["- (none)"])
  ];

  return lines.join("\n");
}

function describePersonaToolForKbPrompt(tool: PersonaXapiToolDefinition): string {
  const t = tool.type;
  if (t === "file_search") {
    const source = (tool as { source?: { collection_ids?: string[] } }).source;
    const ids = source?.collection_ids?.filter(Boolean) ?? [];
    const idPart = ids.length > 0 ? ` → collection_ids: ${ids.join(", ")}` : "";
    return `- file_search${idPart}`;
  }
  if (t === "collections_search") {
    const raw = (tool as { collection_ids?: string[] }).collection_ids;
    const ids = Array.isArray(raw)
      ? raw.filter((x): x is string => typeof x === "string" && x.trim().length > 0)
      : [];
    const idPart = ids.length > 0 ? ` → collection_ids: ${ids.join(", ")}` : "";
    return `- collections_search (mapped to file_search for xAI)${idPart}`;
  }
  if (t === "atxfinance") {
    return "- atxfinance (portfolio/workspace reads + default-watchlist add/remove; sent to xAI as the atxfinance function tool in ask and batch)";
  }
  return `- ${t}`;
}
