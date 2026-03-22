import {
    ATXFINANCE_TOOL_DEFINITION,
    YAHOO_FINANCE_TOOL_DEFINITION
} from "@/modules/xchat/tool-executor";
import type { PersonaXapiToolDefinition } from "@/modules/xchat/types";

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

/**
 * Expands persona marker tools (`atxfinance`, `yahoo_finance`) into xAI function schemas,
 * same as `POST /api/xchat/ask` before `respondWithXaiToolLoop`. Use for batch and any
 * path that must mirror persona tool configuration.
 */
export function personaXapiToolsToXaiRequestTools(
  tools: PersonaXapiToolDefinition[]
): Array<Record<string, unknown>> {
  const hasAtxfinance = tools.some((t) => t.type === "atxfinance");
  const hasYahooFinance = tools.some((t) => t.type === "yahoo_finance");
  const base: Array<Record<string, unknown>> = tools
    .filter((t) => t.type !== "atxfinance" && t.type !== "yahoo_finance")
    .map((t) => ({ ...t }));
  if (hasAtxfinance) {
    base.push(ATXFINANCE_TOOL_DEFINITION as unknown as Record<string, unknown>);
  }
  if (hasYahooFinance) {
    base.push(YAHOO_FINANCE_TOOL_DEFINITION as unknown as Record<string, unknown>);
  }
  return toXaiRequestTools(base);
}
