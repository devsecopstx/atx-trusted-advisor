# atx-rag-collection

Source material for xAI collections and RAG ingestion (prompts, reference PDFs).

## Layout

| Path | Convention |
| --- | --- |
| `xpersonas/` | One persona per file, **`kebab-case.md`** (e.g. `finance-expert.md`, `legal-advisor.md`). Aligns with xPersona naming in admin. |
| `finance/` | Reference PDFs; prefer **no spaces** in filenames and consistent vendor-prefix or `kebab-case` for scripts and URLs. |

## Hygiene

- Avoid duplicating the same paragraph twice in a single prompt file.
- Shared-repo prompts should stay **generic** — scrub personal events, budgets, and real names unless the file is explicitly private-sample (then do not merge to `main`).

## Docs parity

When this tree changes materially, mention it in **`DEVELOPMENT.md`** or an `atx-docs/` note if operators need upload or sync steps (see **`.cursor/skills/generate-docs/SKILL.md`**).

**Runtime chat model** for the app (including new xPersonas in Admin) follows **`XAI_CHAT_MODEL`**; canonical default in **`.env.example`** is **`grok-4-1-fast-reasoning`**.
