# xChat — HNWI templates & persona picker (Grok-style shell)

**UI Patterns:** See the canonical guidance in [`../design-system/ui-primitives-and-patterns.md`](../design-system/ui-primitives-and-patterns.md#7-xchat-specific-patterns) (composer rail, templates gallery, persona menu, soft theme overrides, workspace rail integration).

Approved **app_user** xChat composer polish: curated **Templates** gallery + **persona** popover (Auto + published personas).

## Templates

| Piece | Detail |
|-------|--------|
| **Source** | `src/modules/xchat/xchat-hnwi-templates.ts` — `XCHAT_HNWI_PROMPT_TEMPLATES` (HNWI / Investment Advisor-oriented prompts; each card uses Desk Report **v2.1** via `hnwiV21Slug` + `GET …/prompt-template-v21/{slug}` before send). |
| **UI** | `src/app/xchat/ui/xchat-templates-strip.tsx` — **`xchat-templates-strip__top-row`**: pulse + **Workspace library** heading + **N prompts ready** badge + **See all** / overflow (**⋯**); optional search; compact **pill** scroller (**`role="group"`**, arrow-key scroll when focused) or **See all** grid + **Custom prompt**. Pulse reuses **`xchat-workspace-bar__pulse`** styles from `xchat-templates-workspace-bar.tsx`. |
| **Behavior** | Clicking a card fills the composer (`setInput`); user reviews before **Send**. Not auto-submit. **Wheel / CC scan** template asks for a **markdown desk report** (same desk field contract as `income-ideas-prompt.ts`); not JSON-only. **Legacy saved prompts** that still contain “desk JSON contract only” for this scan are **rewritten on click** via **`resolveWheelCcScanComposerPrompt`** in `xchat-hnwi-templates.ts`. |
| **Deep link** | `?rail=xchat&item=examples` opens templates with search + **See all** expanded (`templatesGalleryInitiallyExpanded`). |

## Persona picker

| Piece | Detail |
|-------|--------|
| **UI** | `src/app/xchat/ui/xchat-persona-menu.tsx` — replaces native `<select>` for Grok-like rows. |
| **Rows** | Loaded from `GET /api/personas`; client maps optional **`previewLine`** via `personaPreviewLineFromSystemPrompt` (`src/modules/xchat/persona-preview-line.ts`) from **`systemPrompt`** (truncated). |
| **Auto** | Empty selection → tenant default persona for the thread (unchanged server behavior). |

## Styling

**`src/app/xchat/xchat.css`** — `.xchat-templates-strip__*` (**`__header-main`**, **`__scroller--pills`**, **`__card--pill`**, **`__top-row`**), workspace pulse (**`.xchat-workspace-bar__pulse`**), `.xchat-persona-menu__*`; soft theme overrides under `html[data-xf-ui="soft"]`.

## User templates & Depth

| Piece | Detail |
|-------|--------|
| **Saved prompts** | **`GET`/`POST /api/app-user/xchat/prompt-templates`**, **`DELETE /api/app-user/xchat/prompt-templates/{id}`** — Mongo **`xchat_user_prompt_templates`** (per user, max 40). Templates strip **bookmark** opens save dialog; saved cards show **×** to delete. |
| **Depth** | **`XchatReasoningModeToggle`** — **Fast** / **Expert** / **Heavy**; persisted in **`localStorage`** (`xf_xchat_reasoning_mode`). Sent as **`reasoningMode`** on **`POST /api/xchat/ask`** (omit when Fast). **Expert**/**Heavy** route to **`grok-4.3`** + xAI **`reasoning.effort`** (medium/high per vendor); **multi-agent** persona ids still use **`grok-4.20-multi-agent`** + plan **`multiAgentParallelMaxAgents`** when that path applies ([context-routing-multi-agent-policy.md](./context-routing-multi-agent-policy.md), [xAI reasoning](https://docs.x.ai/developers/model-capabilities/text/reasoning#the-reasoning_effort-parameter)). The composer toolbar shows the routed model label beside the Depth pills (**Fast** → Grok 4.1 Fast; **Expert**/**Heavy** → Grok 4.3). |
| **Composer rail** | **`XchatComposerRailRouting`** under **Composer** — persona model, Depth preset, last-turn execution model + selection source, and RAG summary from the latest ask response (replaces the old Enter/Shift+Enter shortcut copy). |

**PLAN.md** priority **707** — closed.
