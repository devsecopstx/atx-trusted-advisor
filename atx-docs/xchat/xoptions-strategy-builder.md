# xOptions — Option Strategy Builder (`/xoptions`)

## UX flow

The strategy builder is a **gated, four-step** flow (mirrors common broker research patterns):

1. **Input symbol** — Account selector, optional “options not enabled” notice, symbol field and **Next**.
2. **Choose outlook** — Session outlook/risk overrides vs portfolio defaults.
3. **Choose strategy** — Collapsible **Single-leg** vs **Multi-leg**; single-leg shows three concise cards (buy calls, covered calls, cash-secured puts) with tier, bullets, mini P/L sketch, and **Learn more** to xStrategyBuilder. Legend: strike vs breakeven markers. Target expiration (week chips) and scoring weights sit below the cards.
4. **Choose contract** — Quote / ±% moves, embedded chain scanner, **Open option chain** CTA.

Steps **unlock in order** (horizontal stepper + vertical sections). Clearing the symbol resets to step 1 and locks later steps.

## API

- **`GET /api/app-user/find-options/context`** — Returns `portfolio`, `accounts[]` (custodian rows with `optionsApproved`, `extAccountId`, desk fields), and `account` (default selection summary, including `optionsApproved`).

## Options eligibility

- Per-account Mongo field **`optionsTradingEnabled`** (`boolean`): when set, overrides the env default for that account.
- **`XOPTIONS_ASSUME_OPTIONS_APPROVED`** (server env, default false): when true, accounts without `optionsTradingEnabled` are treated as approved.
- Optional **`NEXT_PUBLIC_XOPTIONS_OPTIONS_APPLY_URL`**: absolute URL for the “Apply here” link next to the notice (e.g. custodian options application). If unset, the link is omitted.

Research and chain tools remain available when `optionsApproved` is false; the notice is informational for trading readiness.
