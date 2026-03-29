/**
 * Client-safe tool types (no mongodb). Used by tool-definitions and xai-tools
 * so they can run in browser bundles without pulling in Mongo/core-admin.
 */
export const PERSONA_XAPI_TOOL_TYPES = [
  "web_search",
  "x_search",
  "code_interpreter",
  "file_search",
  "collections_search",
  "yahoo_finance",
  "atx_function",
  // Legacy alias kept for backward compatibility with existing persona rows.
  "atxfinance"
] as const;
export type PersonaXapiToolType = (typeof PERSONA_XAPI_TOOL_TYPES)[number];

export type PersonaXapiToolDefinition = {
  type: PersonaXapiToolType;
  [key: string]: unknown;
};
