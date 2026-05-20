# Grok skills index (atxFinance)

Project-local **Grok skills** under **`.grok/skills/`** (parallel to `.cursor/skills/`). These package deep knowledge from `atx-docs/` (especially RAG sources powering the xChat HNWI / finance-advisor surface) into actionable agent playbooks.

- **Purpose**: Enable Grok to deliver higher-quality, consistent assistance when you work on the xChat surface, finance-advisor persona, options strategies for Investment Advisor / HNWI users, RAG curation, persona ops, and Desk Report flows.
- **Audience (indirect benefit)**: Your xChat finance-advisor users ultimately benefit because devs using Grok + these skills ship better persona behavior, more accurate strategy responses, tighter tool/RAG discipline, and faster iteration on the HNWI desk experience.
- **Relationship to Cursor skills**: `.cursor/skills/` (55+ entries) are for Cursor agents (options playbooks, design reviews, deploy, etc.). Grok skills focus on the *xAI/xChat execution surface* and the finance knowledge that lives in `atx-docs/rag-collection/`.
- **Authoring**: Follow patterns from `.cursor/skills/skill-authoring.md` (frontmatter: required `name` + `description`; optional `skill_family`, `last_updated`). Keep bodies short, trigger-phrase rich, and source-linked.
- **Discovery**: Use `/<skill-name>` or mention the skill name in chat. Skills auto-reload on disk change.
- **Source truth**: All finance/strategy content originates in `atx-docs/rag-collection/` (seeded to xAI Finance collection + linked via persona `always_include`). Never duplicate long excerpts here — reference + extract guardrails/contracts.

## Default skill policy (Grok)

| Skill | When |
|-------|------|
| `hnwi-xchat-finance-advisor` | Any xChat, persona, or finance-advisor user workflow (primary) |
| `finance-rag-kb-curation` | Adding/updating RAG sources in `atx-docs/rag-collection/`, refresh-finance, pre-search filter work |
| `xchat-persona-and-rag-ops` | Persona YAML changes, collection linking, seeding, `always_include` contracts |
| `xchat-hnwi-desk-reports` | HNWI Desk Report v2.1 templates, prompt-templates-v21, xchat-hnwi-v21-desk-report flows |

## xChat / HNWI Finance Focus Areas

- **Primary persona**: `finance-advisor` (and `advisor` fallback) in `atx-docs/rag-collection/xpersonas/finance-advisor/finance-advisor.yaml`
- **Core RAG slices** (always pulled for finance-advisor): `finance-core/**`, `atx-response-guidelines/**`, `options-strategy-core/**`, `options-strategy-advanced/**`
- **Response contracts**: `compliance-disclaimers.md` (universal + strategy-specific — never omit), `response-structure.md` (exact 5-part outline)
- **Desk vocabulary**: Conservative / Balanced / Aggressive risk buckets; outlook (neutral-bullish, range, event, etc.); xfinance-strategy-* ids
- **Tool discipline** (from persona + tools guide): ≤3 tool calls/turn preferred; use `atx_function` (workspace) + `yahoo_finance` first for live data; RAG for structures/playbooks; AIP-160 filters on pre-search for `finance-core` + options legs
- **HNWI Desk v2.1**: Concentration, Wheel/CC/CSP scan, protective puts, watchlist pass, options desk snapshot — output as structured Markdown desk report + server add-on
- **Seeding**: `npm run seed:finance-xai-collection` / Admin RAG refresh → `XAI_FINANCE_COLLECTION_ID`; personas declare via `always_include` (logical `atx-rag-collection/...` paths)

## When to add a new Grok skill here

- Recurring high-value workflow that touches the finance-advisor xChat surface or its source docs.
- Knowledge that benefits from being "pre-digested" with guardrails + exact output contracts (like the Cursor options playbooks).
- Cross-cutting concerns (RAG filters, tool vs RAG routing, compliance, HNWI report shapes) that multiple personas or features share.

Do **not** create one skill per options strategy (that lives in Cursor + the narrative docs). Prefer aggregation + pointers.

## Related

- `atx-docs/rag-collection/options-strategy-xchat-seeding.md` — why RAG over live invention for cost/latency
- `atx-docs/xchat/xchat-tools-guide.md` — full ask flow, Responses tool loop, pre-RAG, metadata filters
- `atx-docs/xchat/context-routing-multi-agent-policy.md` — RAG-first, tool-second
- `.cursor/skills/skill-xchat-validation-checklist/SKILL.md` and `xchat-rag-xai-design-review/SKILL.md` — complementary Cursor gates
- `AGENTS.md` — full local flow, xChat health checks, persona defaults
- `atx-docs/README.md` — RAG ingest + persona contracts

Run `ls -R .grok/skills` after changes. Skills appear in `/skills` menu shortly after write.
