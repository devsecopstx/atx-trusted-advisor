/**
 * Persona `model` ids that use xAI multi-agent parallelism when the ask route does not
 * downgrade for retrieval-first policy. Kept in one module for ask + admin UI hints.
 * @see `src/app/api/xchat/ask/route.ts` — downgrade unless `reasoningEffort` or `heavySynthesisIntent`
 * @see `atx-docs/xchat/context-routing-multi-agent-policy.md`
 */
/** Default multi-agent id used when Expert / Heavy modes escalate a non–multi-agent persona for one turn. */
export const PRIMARY_MULTI_AGENT_PERSONA_MODEL_ID = "grok-4.20-multi-agent" as const;

export const MULTI_AGENT_PERSONA_MODEL_IDS = new Set<string>([
  PRIMARY_MULTI_AGENT_PERSONA_MODEL_ID,
  "grok-4.20-multi-agent-0309"
]);

export function isMultiAgentPersonaModelId(model: string): boolean {
  return MULTI_AGENT_PERSONA_MODEL_IDS.has(model.trim());
}
