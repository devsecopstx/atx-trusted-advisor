import { ATXFINANCE_COLLECTION_ID, type PersonaXapiToolDefinition } from "@/modules/xchat/types";

/**
 * Appends structured context so batch jobs mirror "KB-style" awareness: default collection id,
 * persona RAG collection, and the persona's tool list (including types stripped from the API
 * request, e.g. `atxfinance`).
 */
export function buildBatchUserPromptAugmentation(input: {
  tools: PersonaXapiToolDefinition[];
  personaRagCollectionId?: string;
}): string {
  const envId = (process.env.ATXFINANCE_COLLECTION_ID ?? "").trim();
  const defaultKbCollectionId = envId || ATXFINANCE_COLLECTION_ID;

  const toolLines = input.tools.map((tool) => describePersonaToolForBatchPrompt(tool));

  const lines = [
    "[Persona / batch metadata for this item — use when relevant; do not echo as the user]",
    `ATXFINANCE_COLLECTION_ID (default knowledge-base collection): ${defaultKbCollectionId}`,
    ...(input.personaRagCollectionId?.trim()
      ? [
          `Persona RAG / file_search collection (pre-search + retrieval for this batch): ${input.personaRagCollectionId.trim()}`
        ]
      : []),
    "Persona xAPI tools (as configured in admin):",
    ...(toolLines.length > 0 ? toolLines : ["- (none)"])
  ];

  return lines.join("\n");
}

function describePersonaToolForBatchPrompt(tool: PersonaXapiToolDefinition): string {
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
    return "- atxfinance (custom tool — not executed in batch API; listed for parity with persona config)";
  }
  return `- ${t}`;
}
