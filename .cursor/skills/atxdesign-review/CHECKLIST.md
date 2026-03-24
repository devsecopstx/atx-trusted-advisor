# atxdesign-review Checklist

## Core Review Checklist

Run this baseline checklist on every design review:

- [ ] `design-review-best-practices` baseline dimensions covered:
  - architecture boundaries, duplication, dead code
  - TypeScript/Next.js quality and contract safety
  - backend/service-layer boundary quality where applicable
  - security posture (secrets, auth boundaries, validation, injection risk)
  - data/API quality (contracts, compatibility, error taxonomy)
  - testing/quality gates and documentation/DX quality
- [ ] Code correctness, type safety, and error-handling paths verified
- [ ] Documentation coverage reviewed for changed subsystems and runbooks

## Grok-Inspired Visual/Icon Gate

Run this gate whenever PR scope includes UI components, design tokens, icons, or visual behavior:

- [ ] Theme + layout:
  - dark/light mode parity is preserved
  - centered/simple layouts with generous negative space
  - bubble-style message surfaces (if present) remain clear and consistent
- [ ] Color + typography:
  - high-contrast black/white base with restrained accent pops
  - minimal hue variety; avoid decorative palette drift
  - bold heading hierarchy + readable body typography with clean sans-serif usage
- [ ] Product feel:
  - modular, scalable, software-like precision
  - no unnecessary visual flourishes that reduce comprehension speed
- [ ] Icon system:
  - minimalist, geometric icons with strong small-size legibility
  - consistent outline/filled style and stroke weight (about 2px base feel)
  - high-contrast variants; no heavy shadows/interior gradients/ornate detail
  - slight rounding only when functional; keep technical sharpness
  - uniform grid alignment and balanced proportions; avoid cliche motifs

## Persona Config + Tool Routing Gate (Responses API)

Run this gate whenever PR scope includes persona orchestration, prompt config, tool routing, or retrieval behavior:

- [ ] Endpoint contract:
  - uses `/v1/responses` for tool-calling flows
  - does not regress to legacy chat completion route for tool orchestration
- [ ] Persona prompt contract:
  - `system_prompt` enforces collection-first retrieval
  - `system_prompt` allows web-search fallback only when collection data is missing
  - `system_prompt` requires explicit source citations
  - `system_prompt` requires honest unknown handling when no evidence is found
- [ ] Tools contract:
  - `file_search` is configured with environment-correct `collection_ids`
  - `web_search` and `code_interpreter` are enabled only when needed by product behavior
  - top-level `tools` array is used (no ad hoc tool declarations inside user content)
- [ ] Routing behavior:
  - Ask route uses one `/v1/responses` tool-loop execution path (no mixed chat-completions fallback) unless explicitly documented as a rollback exception
  - `tool_choice` defaults to `auto` unless constrained policy is documented
  - runtime behavior avoids fabricated internal-doc claims when retrieval misses
- [ ] Multi-agent model policy:
  - ask fallback model remains `grok-4.20-multi-agent-0309` (or approved `grok-4.20-multi-agent`)
  - `reasoningEffort` constraints match multi-agent-only behavior and route validation
- [ ] Admin ownership constraints:
  - persona `name`, `systemPrompt`, `overridePrompt`, and `collectionIds` are mutable by admin role only
  - non-admin mutation attempts are denied with clear contract-safe errors
- [ ] Wrapper + defaults contract:
  - persona remains a thin wrapper (unique name, enabled tools list, prompts)
  - defaults/fallbacks are explicit and deterministic when optional fields are omitted

## Legacy Prompt + Asset Capture Gate

Run this gate whenever PR scope includes prompt migration, persona parity checks, or legacy branding references:

- [ ] Example prompt inventory captured from legacy/source app and stored in `atx-docs/atx-xchat/xdesign-review-legacy-prompts-inventory.md`
- [ ] Default legacy persona fallback behavior documented (default persona + no-persona backward compatibility)
- [ ] `xf-legacy-*` assets in `atx-branding/` enumerated and validated against docs references
- [ ] If prompts/assets changed, sync `atx-branding/README.md` and `atx-branding/atxfinance-brand-validation.md` as needed

## Phase 1 PR Review Report Requirement

For Phase 1 scope, final report must use the `Phase 1 PR Review Template` in `atxdesign-review/SKILL.md` and include all sections:

- Findings (`High`, `Medium`, `Low`)
- Reviewer completion block (`complete`/`incomplete`)
- Grok-inspired visual/icon gate (`pass`/`fail` by group)
- Persona config + tool routing gate (`pass`/`fail` by group)

## Companion Reviewer Checklist

Run these companion reviewers when relevant and include their findings in the design review report:

- [ ] `xrag-xai-design-review` (RAG architecture, model/tool routing, cost/performance)
- [ ] `xdesign-review-audit` (traceability, auditability, non-repudiation)
- [ ] `xdesign-review-adversarial` (exploitability, prompt/data attack surfaces, runtime containment)
- [ ] `xdesign-review-reliability` (SLOs, resilience, failure-mode containment, batch-first efficiency)
- [ ] `generate-docs` (documentation coverage, accuracy, and runbook quality)
- [ ] `test-automation` (coverage gaps, regression tests, edge-case tests)
