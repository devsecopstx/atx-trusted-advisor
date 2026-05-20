---
name: xchat-persona-and-rag-ops
description: Authoring, governance, collection attachment, and seeding workflows for xChat personas (especially finance-advisor and advisor) and their RAG linkages. Use for persona YAML edits, publish/archive/rollback, always_include tuning, XAI_FINANCE_COLLECTION_ID wiring, or verification after seed:admin / seed:finance-xai-collection. Trigger: persona YAML, finance-advisor persona, collection link, rag refresh, xpersonas.
skill_family: xchat-persona
last_updated: 2026-05-20
---

# xchat-persona-and-rag-ops

End-to-end expert for the **persona layer** that selects which finance knowledge and tools your xChat users (and admins) actually receive.

## Persona YAML Location & Contract

All production personas live in `atx-docs/rag-collection/xpersonas/<id>/<id>.yaml`.

Critical fields for finance-advisor work:

- `id`, `name`, `description`, `icon`, `color`
- `model`: grok-4-1-fast-reasoning (or grok-4.3 / multi-agent variants)
- `system_prompt`: the long contract (see finance-advisor.yaml for the exact finance-advisor version)
- `always_include`: array of logical paths under `atx-rag-collection/...` that must be available for RAG (these drive `resolveXchatPersonaDeclaredCollectionIds`)
- `never_include`: globs to exclude from any disk walks
- `commands`: optional natural-language shortcuts (e.g. "options-setup")
- Tool declarations (implicit via the platform + explicit in system_prompt): atx_function family + yahoo_finance

The `finance-advisor` persona is the current recommended default for app_user finance/IA users (Series 7/65 framing + strict scope + income/strategy depth).

## Lifecycle & Governance (admin console + API)

Personas support `draft` → `published` → `archived`.

Actions that must emit audit:
- publish (creates version snapshot)
- archive (hides from non-admin directory)
- rollback (restores prior snapshot)

`xchat_platform_settings.defaultAppUserPersonaId` controls the fallback for regular signed-in users after `seed:admin`.

Global admins can still reach other published personas (including exam-coach, tax-expert, legal, quant-trader) via the rail when policy allows.

## Collection & RAG Attachment Rules

- Runtime always uses the **shared Finance collection** (`XAI_FINANCE_COLLECTION_ID` env) as the base.
- Persona `xaiCollection` / `teamCollection` / tool `collection_ids` may add **at most one extra** collection (max 2 total for the ask).
- `always_include` in the YAML is the operator contract that tells seed/refresh scripts and reviewers what must be present in the Finance collection for that persona to behave correctly.
- After any change to a persona's `always_include` or to the RAG tree, run the finance collection refresh + smoke an ask that exercises the new path.

## Verification Sequence (post change or after seed:admin)

1. `GET /api/health` + `GET /api/personas` (as global_admin session) — advisor and finance-advisor must appear published.
2. Ask as global_admin → resolves advisor (or assigned).
3. Ask as app_user (viewer/operator/advisor role) → resolves the tenant's defaultAppUserPersonaId (usually finance-advisor or advisor).
4. Smoke a pure-RAG question ("explain wheel strategy guardrails for a balanced book") — expect citation from options-strategy-core or advanced, minimal tool calls.
5. Smoke a workspace question ("scan my watchlist for wheel candidates") — expect atx_function + yahoo_finance calls + proper USD formatting on targets.
6. Check compliance disclaimer is present on every reply.

See also the Cursor `skill-xchat-validation-checklist` for the broader matrix.

## Common Pitfalls & Fixes

- Persona missing after seed → re-run `seed:admin` (or the specific persona seed) and confirm `SKIP_*` flags are not set.
- RAG not hitting after doc add → confirm the file has correct frontmatter (category, complexity, surface, doc_type), re-run refresh, wait for indexing, then retest.
- Tool calls exploding → persona system_prompt or prompt build is missing the "≤3 calls, prefer bulk atx_function" language; or pre-search filters are too loose.
- Wrong persona for app users → check `xchat_platform_settings.defaultAppUserPersonaId` in the tenant doc.
- 503 on ask → default persona row deleted or not published; restore via rollback or re-seed.

## Related Commands & Scripts

- `npm run seed:admin` (full bootstrap including personas + finance KB sync unless skipped)
- `npm run seed:finance-xai-collection`
- `npm run ops:migrate:xchat-personas-finance-collection -- --execute`
- `npm run xchat:migrate-performance` (after touching xchat_* collections)
- Admin UI: Personas list + editor, RAG collections inventory, "Sync Finance Collection to xAI"

## When Editing a Persona YAML

- Keep the refusal phrase and scope language identical across finance-focused personas.
- Update the corresponding `always_include` block if you add/remove RAG segments.
- Bump `last_updated` style comment if present.
- After edit: run typecheck + the persona smoke tests + a live ask against the updated persona (use session cookie or admin override).
- Document the change in release notes + link the persona YAML path.

## Output When This Skill Is Active

- Exact YAML diff with justification tied to the runtime contracts.
- Command sequence to validate end-to-end (local → staging).
- Audit event expectations and collection readiness checks.
- Clear "this change affects which users" matrix (global_admin vs app_user roles, changePersonaEnabled policy).
