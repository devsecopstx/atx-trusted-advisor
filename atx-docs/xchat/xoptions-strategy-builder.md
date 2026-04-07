# xOptions — Find options (`/xoptions`)

## Shell theme & layout CSS

- **Soft / light shell** (`html[data-xf-ui="soft"]`): Page background uses **`--xf-xoptions-surface`** (mapped to **`--xf-bg-900`** in `globals.css`); workspace UI chrome is tuned in **`src/app/xoptions/xoptions.css`** (panels, chain CTA, ATM row contrast). The symbol OHLC/volume charts (`xoptions-symbol-chart-panel.tsx`) switch Apex **light vs dark** grid/labels when the user toggles Appearance.
- **Left rail:** `src/app/xoptions/layout.tsx` imports **`portfolios-dashboard.css`** alongside **`xchat.css`** so **`WorkspaceProductSidebar`** Lucide rail icons use **`portfolios-workspace-sidebar__glyph`** sizing (same requirement as **`xchat/layout.tsx`**).

## UX flow

The strategy builder is a **gated, four-step** flow (mirrors common broker research patterns):

1. **Input symbol** — **Workspace** row under the title: **Portfolio · Account** on the left and a collapsed **Preferences** panel on the right (scoring factor weight overrides). Full-width optional options-not-enabled notice below the row. Then the horizontal **stepper**. **Symbol** and **At a glance** (holdings + hot list) share one row (two columns on wide layouts). Account context comes from the left rail. **Next** advances when the symbol is ready.
2. **Choose outlook** — Session outlook/risk overrides vs portfolio defaults.
3. **Choose strategy** — Collapsible **Single-leg** vs **Multi-leg**; single-leg shows three cards (buy calls, covered calls, cash-secured puts). Multi-leg shows **Buy write**, **Long call spread**, and **Short put spread** (tier, bullets, **At expiration** notes, mini P/L sketch, **Learn more**). Shared legend: ◇ strike, ● breakeven; x = stock price, y = P/L. Scoring weights live under **Preferences** in the workspace row.
4. **Choose contract** — **Target expiration** week chips (1/2/4 wk) set a suggested expiration; user must pick **expiration**, **strike**, **limit** (type or use bid), and **quantity** before chain and payoff unlock from the blurred “not loaded” state. **Calls / Puts** and **Show all strike prices** apply after the chain loads. The **option chain** table (soft + deep themes) uses: alternating row striping; **ATM** pill on the strike nearest spot; faint **ITM** green tint (calls: strike below spot; puts: strike above); **Vol** / **OI** columns with a light green heatmap scaled to the **visible** rows; **Bid** (strong green) / **Ask** (softer green-gray) / **Mid** / **BE** / **IV%**; bid-ask **spread** hint under bid; **Greeks** (Δ, Γ, Θ/day, Vega) with header `title` explainers — on **narrow viewports (below 1024px)** use **Show Greeks** / **Hide Greeks** to toggle those columns; on **desktop** they stay visible with tighter right-aligned numerics. **Selected** row: light fill plus **#8b5cf6** left border; entire row is clickable (bid still sets limit and does not double-fire row select); a **Select** control appears on hover (or dimmed on touch). Column headers show non-functional **sort** glyphs for future use. **Review order** shows limit, breakeven, and P(OTM) in one row (with gauge) plus narrative in an info box, and includes the selected **Yahoo option chain id** (contract symbol). Actions under step 4: **Add to watchlist** (adds selected contract with rich metadata), **Open full option chain**, and **Ask xChat** (copies review text minus the small panel disclaimer into clipboard and opens **xChat** with composer prefilled via `sessionStorage` key `xf_xchat_pending_prompt_v1`).

Steps **unlock in order** (horizontal stepper + vertical sections). Clearing the symbol resets to step 1 and locks later steps.

## API

- **`GET /api/app-user/find-options/context`** — Returns `portfolio`, `accounts[]` (custodian rows with `optionsApproved`, `extAccountId`, desk fields), and `account` (default selection summary, including `optionsApproved`).

## Options eligibility

- Per-account Mongo field **`optionsTradingEnabled`** (`boolean`): when set, overrides the env default for that account.
- **`XOPTIONS_ASSUME_OPTIONS_APPROVED`** (server env, default false): when true, accounts without `optionsTradingEnabled` are treated as approved.
- Optional **`NEXT_PUBLIC_XOPTIONS_OPTIONS_APPLY_URL`**: absolute URL for the “Apply here” link next to the notice (e.g. custodian options application). If unset, the link is omitted.

Research and chain tools remain available when `optionsApproved` is false; the notice is informational for trading readiness.

## Sidebar toggle: xStrategybuilder

- Under **xOptions** in the left rail, a checkbox row **xStrategybuilder** controls whether the **Hardcore strategy jobs** panel is visible.
- Toggle state is client-persisted in local storage (`xf_xoptions_strategy_builder_visible_v1`) and synced live across xOptions sidebar/workspace via a custom browser event (`xoptions:strategy-builder-visibility-changed`).
