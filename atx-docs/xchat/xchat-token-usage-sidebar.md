# xChat sidebar token usage (app user)

## Purpose

Approved **app users** see **estimated token usage** in the **xChat** left rail under **Composer** (`XchatSidebarTokenStats`): lifetime sum plus a **trailing average tokens/minute** so traders can gauge recent intensity without exposing raw prompts.

## API

| Method | Path | Auth |
|--------|------|------|
| `GET` | `/api/app-user/xchat/token-stats` | Approved app user session (`requireApprovedAppUserSession`) |

**Response** (`200`): JSON envelope:

```json
{
  "data": {
    "totalTokens": 0,
    "turnsWithUsage": 0,
    "tokensLast60Minutes": 0,
    "turnsWithUsageLast60Minutes": 0,
    "tokensPerMinuteAvg60m": 0,
    "windowMinutes": 60,
    "computedAt": "2026-05-07T12:00:00.000Z"
  }
}
```

- **`totalTokens` / `turnsWithUsage`** — Sum / count over all **`xchat_logs`** rows for the session **user + tenant** (`mongoXchatLogsTenantScope`, **`userTenant`** mode) where **`xaiUsage.totalTokens`** is present (missing usage counts as **0**).
- **`tokensLast60Minutes`** — Same scope, **`createdAt`** within the last **`windowMinutes`** (60).
- **`tokensPerMinuteAvg60m`** — `tokensLast60Minutes / windowMinutes`, rounded to **one decimal** (server); **0** when no tokens in the window.

**Caching:** `Cache-Control: private, max-age=55` — browsers may reuse briefly; the **client** refreshes at most **once per ~60s** (interval + client-side minimum gap).

## Client behavior

- **File:** `src/app/xchat/ui/xchat-sidebar-token-stats.tsx`
- **Mount:** Only in **`XchatConversation`** (custom **`xchatSection`** rail), not the generic workspace sidebar fallback.
- **Polling:** Initial fetch on mount; **`setInterval` 60s**; skips a fetch if the previous started under **55s** ago.

## Limits / caveats

- **Voice realtime** and other paths that **do not** write **`xchat_logs`** with **`xaiUsage`** are **not** included.
- Rows outside **Mongo TTL / retention** on **`xchat_logs`** disappear from totals over time.
- **Not** a billing meter — for orientation only; plan enforcement remains **`xchat_usage_limits`** / ask-rate paths.

## Tests / inventory

- Route: `tests/integration/xchat-token-stats-route.test.ts`
- Repository aggregates: `tests/unit/xchat-token-usage-stats-repository.test.ts`
- OpenAPI inventory: `src/lib/openapi/current-state.ts` → **`/api/app-user/xchat/token-stats`**
