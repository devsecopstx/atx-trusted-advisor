# xOptions — Find options (`/xoptions`)

## UX flow

The strategy builder is a **gated, four-step** flow (mirrors common broker research patterns):

1. **Input symbol** — **Workspace** row under the title: **Portfolio · Account** on the left and a collapsed **Preferences** panel on the right (scoring factor weight overrides). Full-width optional options-not-enabled notice below the row. Then the horizontal **stepper**. **Symbol** and **At a glance** (holdings + hot list) share one row (two columns on wide layouts). Account context comes from the left rail. **Next** advances when the symbol is ready.
2. **Choose outlook** — Session outlook/risk overrides vs portfolio defaults.
3. **Choose strategy** — Collapsible **Single-leg** vs **Multi-leg**; single-leg shows three cards (buy calls, covered calls, cash-secured puts). Multi-leg shows **Buy write**, **Long call spread**, and **Short put spread** (tier, bullets, **At expiration** notes, mini P/L sketch, **Learn more**). Shared legend: ◇ strike, ● breakeven; x = stock price, y = P/L. Scoring weights live under **Preferences** in the workspace row.
4. **Choose contract** — **Target expiration** week chips (1/2/4 wk) set a suggested expiration; user must pick **expiration**, **strike**, **limit** (type or use bid), and **quantity** before chain and payoff unlock from the blurred “not loaded” state. **Calls / Puts** and **Show all strike prices** apply after the chain loads. **Open full option chain** → xStrategyBuilder.

Steps **unlock in order** (horizontal stepper + vertical sections). Clearing the symbol resets to step 1 and locks later steps.

## API

- **`GET /api/app-user/find-options/context`** — Returns `portfolio`, `accounts[]` (custodian rows with `optionsApproved`, `extAccountId`, desk fields), and `account` (default selection summary, including `optionsApproved`).

## Options eligibility

- Per-account Mongo field **`optionsTradingEnabled`** (`boolean`): when set, overrides the env default for that account.
- **`XOPTIONS_ASSUME_OPTIONS_APPROVED`** (server env, default false): when true, accounts without `optionsTradingEnabled` are treated as approved.
- Optional **`NEXT_PUBLIC_XOPTIONS_OPTIONS_APPLY_URL`**: absolute URL for the “Apply here” link next to the notice (e.g. custodian options application). If unset, the link is omitted.

Research and chain tools remain available when `optionsApproved` is false; the notice is informational for trading readiness.
