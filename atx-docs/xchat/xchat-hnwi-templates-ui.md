# xChat — HNWI templates & persona picker (Grok-style shell)

Approved **app_user** xChat composer polish: curated **Templates** gallery + **persona** popover (Auto + published personas).

## Templates

| Piece | Detail |
|-------|--------|
| **Source** | `src/modules/xchat/xchat-hnwi-templates.ts` — `XCHAT_HNWI_PROMPT_TEMPLATES` (HNWI / RIA-oriented prompts; workspace-aware wording). |
| **UI** | `src/app/xchat/ui/xchat-templates-strip.tsx` — **single top row** (**`xchat-templates-strip__top-row`**) with label **Templates** + **`XchatTemplatesWorkspaceBar`** (“Workspace library” / compile status); below that: search, **+**, **See all**, horizontal strip or full grid, **Custom prompt** card. |
| **Behavior** | Clicking a card fills the composer (`setInput`); user reviews before **Send**. Not auto-submit. |
| **Deep link** | `?rail=xchat&item=examples` opens templates with search + **See all** expanded (`templatesGalleryInitiallyExpanded`). |

## Persona picker

| Piece | Detail |
|-------|--------|
| **UI** | `src/app/xchat/ui/xchat-persona-menu.tsx` — replaces native `<select>` for Grok-like rows. |
| **Rows** | Loaded from `GET /api/personas`; client maps optional **`previewLine`** via `personaPreviewLineFromSystemPrompt` (`src/modules/xchat/persona-preview-line.ts`) from **`systemPrompt`** (truncated). |
| **Auto** | Empty selection → tenant default persona for the thread (unchanged server behavior). |

## Styling

**`src/app/xchat/xchat.css`** — `.xchat-templates-strip__*` (including **`__top-row`** beside **`.xchat-workspace-bar`**), `.xchat-persona-menu__*`; soft theme overrides under `html[data-xf-ui="soft"]`.

## User templates & Depth

| Piece | Detail |
|-------|--------|
| **Saved prompts** | **`GET`/`POST /api/app-user/xchat/prompt-templates`**, **`DELETE /api/app-user/xchat/prompt-templates/{id}`** — Mongo **`xchat_user_prompt_templates`** (per user, max 40). Templates strip **bookmark** opens save dialog; saved cards show **×** to delete. |
| **Depth** | **`XchatReasoningModeToggle`** — **Fast** / **Expert** / **Heavy**; persisted in **`localStorage`** (`xf_xchat_reasoning_mode`). Sent as **`reasoningMode`** on **`POST /api/xchat/ask`** (omit when Fast). **Expert**/**Heavy** route to **`grok-4.3`** + xAI **`reasoning.effort`** (medium/high per vendor); **multi-agent** persona ids still use **`grok-4.20-multi-agent`** + plan **`multiAgentParallelMaxAgents`** when that path applies ([context-routing-multi-agent-policy.md](./context-routing-multi-agent-policy.md), [xAI reasoning](https://docs.x.ai/developers/model-capabilities/text/reasoning#the-reasoning_effort-parameter)). |

**PLAN.md** priority **707** — closed.
