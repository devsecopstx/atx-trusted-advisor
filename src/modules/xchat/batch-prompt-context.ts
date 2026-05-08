import type { PersonaXapiToolDefinition } from "@/modules/xchat/types";

/**
 * KB suffix for **ask and batch** user turns: resolved collection ids + persona tool list (no env default).
 */
export function appendXchatKbMetadata(input: {
  tools: PersonaXapiToolDefinition[];
  linkedCollectionIds: string[];
  /** When set, replaces the default resolved-collections line (e.g. xChat ask TEAM-only scope). */
  resolvedCollectionsLine?: string;
}): string {
  const toolLines = input.tools.map((tool) => describePersonaToolForKbPrompt(tool));
  const linked = input.linkedCollectionIds.filter((id) => id.trim().length > 0);

  const resolvedLine =
    typeof input.resolvedCollectionsLine === "string" && input.resolvedCollectionsLine.trim().length > 0
      ? input.resolvedCollectionsLine.trim()
      : linked.length > 0
        ? `Resolved xAI collection ids (persona xaiCollection + teamCollection + tool collection_ids): ${linked.join(", ")}`
        : "Resolved xAI collection ids: (none — configure xPersona xaiCollection, teamCollection, or collection ids on file_search / collections_search tools)";

  const lines = [
    "[Persona / KB metadata — xChat and batch; use when relevant; do not echo as the user]",
    resolvedLine,
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
  if (t === "atx_function") {
    return "- atx_function (portfolio/workspace reads + default-watchlist add/remove + Premium NL price_alert_manage; sent to xAI as the atx_function function tool in ask and batch)";
  }
  return `- ${t}`;
}
