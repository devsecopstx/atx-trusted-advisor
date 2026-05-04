# xChat — HNWI templates & persona picker (Grok-style shell)

Approved **app_user** xChat composer polish: curated **Templates** gallery + **persona** popover (Auto + published personas).

## Templates

| Piece | Detail |
|-------|--------|
| **Source** | `src/modules/xchat/xchat-hnwi-templates.ts` — `XCHAT_HNWI_PROMPT_TEMPLATES` (HNWI / RIA-oriented prompts; workspace-aware wording). |
| **UI** | `src/app/xchat/ui/xchat-templates-strip.tsx` — header (**Templates**, search, **+**, **See all**), horizontal strip or full grid, **Custom prompt** card. |
| **Behavior** | Clicking a card fills the composer (`setInput`); user reviews before **Send**. Not auto-submit. |
| **Deep link** | `?rail=xchat&item=examples` opens templates with search + **See all** expanded (`templatesGalleryInitiallyExpanded`). |

## Persona picker

| Piece | Detail |
|-------|--------|
| **UI** | `src/app/xchat/ui/xchat-persona-menu.tsx` — replaces native `<select>` for Grok-like rows. |
| **Rows** | Loaded from `GET /api/personas`; client maps optional **`previewLine`** via `personaPreviewLineFromSystemPrompt` (`src/modules/xchat/persona-preview-line.ts`) from **`systemPrompt`** (truncated). |
| **Auto** | Empty selection → tenant default persona for the thread (unchanged server behavior). |

## Styling

**`src/app/xchat/xchat.css`** — `.xchat-templates-strip__*`, `.xchat-persona-menu__*`; soft theme overrides under `html[data-xf-ui="soft"]`.

## Backlog

User-authored templates, Grok-like **mode** presets mapped to multi-agent / plan limits — **PLAN.md** priority **707**.
