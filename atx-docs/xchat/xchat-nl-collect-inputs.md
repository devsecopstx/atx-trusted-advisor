# xChat: **NL** (natural-language) input collection

**NL** = **natural language** — short, plain questions the assistant uses to gather **required inputs** before calling structured flows (options analysis, strategy jobs, or future xOptions builder APIs).

## Contract for personas / system copy

1. **Define required slots** for the flow (e.g. underlying, strategy type, expiry window, risk tolerance, position size).
2. If the user’s **nl** request is missing any required slot, **ask one or two focused nl questions** — do not invent symbols, strikes, or sizing.
3. After slots are satisfied (from nl or from **atxfinance** workspace tools when applicable), proceed to reasoning or to the product action (tool call, deep link, or API — whichever is implemented).
4. Prefer **atxfinance** (`portfolio_summary`, `positions_snapshot`, `watchlist_snapshot`) when the user’s question depends on their book — do not re-ask for data the tool already returns.

## xOptions / strategy jobs (current state)

- **Shipped:** Kotlin strategy job API (`/api/strategy-jobs`, turns), multi-agent design in [`atx-multi-agent.md`](./atx-multi-agent.md); app_user xOptions strategy surface `/xoptions` (stepped builder + context API — see [`xoptions-strategy-builder.md`](./xoptions-strategy-builder.md)).
- **Not wired in xChat yet:** There is **no** `atxfinance` operation that creates or posts strategy-job turns. Until that ships, use **nl** to clarify intent and explain that full **xOptions / strategy job** execution runs in the dedicated product flow (UI or API), not via chat tools today.

## See also

- Session tool instructions: `src/modules/xchat/xchat-prompt-build.ts` (`buildSessionToolInstructions`).
- Backlog: [`../PLAN.md`](../PLAN.md) — *NL + xOptions / strategy job tool integration*.
