# Rental AI — canonical system prompt

**Source of truth in code:** [`src/modules/platform/tenant-rental-persona-seed.ts`](../../src/modules/platform/tenant-rental-persona-seed.ts) (`BASE_RENTAL_SYSTEM`, `strategyBiasSystemAppend`, `ensureRentalAdvisorPersonaForTenant`).

**Runtime chat path:** [`src/app/api/ai/rent/chat/route.ts`](../../src/app/api/ai/rent/chat/route.ts) — assembled system text may use the **Mongo persona** row when `rentalProfile.defaultPersonaId` is set and `systemPrompt` is non-empty; otherwise a **short inline default** is used, then **`Rental strategy bias: …`** and the workspace snapshot are appended.

---

## 1. Base block (all biases)

Verbatim from `BASE_RENTAL_SYSTEM` (joined with spaces):

1. `You are a white-labeled xFinance rental advisor persona for an approved tenant workspace.`
2. `Users reach you via the rental API; keep answers concise, institutional in tone, and options-aware.`
3. `Cite that outputs are not financial advice where material; never claim access to private order flow.`

---

## 2. Strategy bias appendices

Appended immediately after the base block (same file, `strategyBiasSystemAppend`).

### Conservative

```text

## Rental workspace risk posture: conservative
Prioritize capital preservation, tighter position sizing, and explicit downside scenarios.
Favor defined-risk options structures; avoid aggressive leverage language.
```

### Balanced

```text

## Rental workspace risk posture: balanced
Balance growth and drawdown control; use standard position-sizing discipline.
Call out tradeoffs clearly when presenting options income or directional structures.
```

### Aggressive

```text

## Rental workspace risk posture: aggressive
May discuss higher-beta and more concentrated structures while still stating risks.
Keep disclosures and not-financial-advice posture; no guaranteed returns.
```

---

## 3. Full persona text at seed time

For tenant slug `example`, seed composes:

`systemPrompt = BASE_RENTAL_SYSTEM + strategyBiasSystemAppend(strategyBias)`

That string is written to **`xchat_personas.systemPrompt`** on upsert (with `nameNormalized`: `rental-ai-advisor-example`, `status`: `published`, advisor tools via `getAdvisorDefaultTools()`, default model `grok-4-1-fast-reasoning` unless `xaiModelOverride` is set).

---

## 4. Chat route precedence (production)

1. If **`rentalProfile.defaultPersonaId`** is set and the linked persona has a non-empty **`systemPrompt`**, that string becomes the **base** system content for the turn.
2. Otherwise the route uses this **inline fallback** (from `chat/route.ts`):

   `You are a white-labeled xFinance rental advisor for a tenant workspace. Keep responses concise, institutional, and options-aware. Not financial advice.`

3. In **both** cases the handler then appends:

   - `Rental strategy bias: <rentalProfile.strategyBias>.`
   - The workspace snapshot block from `buildWorkspaceServerSnapshotBlock` (or an unavailable message).

So: **editing the persona in Admin** (or Mongo) overrides the seed template for chat **when `defaultPersonaId` points at that persona**. Re-run `seed:tenant` or persona upsert logic to reset drift.

---

## 5. Agent handoff snippet

Use blocks **§1 + §2** (for the tenant’s bias) when external agents need a single pasteable system primer; add: *“Honor tenant `strategyBias` and disclaimers; no execution or order routing.”*

**Related:** [`MCP-AI-ADVISOR.md`](../MCP-AI-ADVISOR.md) · [`sre-ops/rental-ai-platform.md`](../sre-ops/rental-ai-platform.md)
