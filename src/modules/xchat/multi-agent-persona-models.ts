/**
 * Persona `model` ids that use xAI multi-agent parallelism when the ask route does not
 * downgrade for retrieval-first policy. Kept in one module for ask + admin UI hints.
 * @see `src/app/api/xchat/ask/route.ts` — downgrade unless `reasoningEffort` or `heavySynthesisIntent`
 * @see `atx-docs/xchat/context-routing-multi-agent-policy.md`
 */
export const MULTI_AGENT_PERSONA_MODEL_IDS = new Set<string>([
  "grok-4.20-multi-agent",
  "grok-4.20-multi-agent-0309"
]);

export function isMultiAgentPersonaModelId(model: string): boolean {
  return MULTI_AGENT_PERSONA_MODEL_IDS.has(model.trim());
}
