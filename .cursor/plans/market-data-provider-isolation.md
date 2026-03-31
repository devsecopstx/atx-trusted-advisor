# Market data provider isolation & Massive/Polygon readiness

**Owner:** SRE + platform (see `.cursor/agents/sre.md`) with app/backend implementing facades.  
**Goal:** Centralize all market quotes/chains behind server-side adapters; allow switching from Yahoo (`yahoo-finance2` / direct Yahoo HTTP) to **Massive.com** (formerly Polygon) REST without changing frontend contracts. Frontend remains **BFF-only** (no vendor keys in browser).

**References:** [Massive REST quickstart](https://massive.com/docs/rest/quickstart), [JVM client for Kotlin backend](https://github.com/massive-com/client-jvm) — Node/BFF uses REST, not JVM.

---

## SRE scope (what this plan optimizes for)

Per `.cursor/agents/sre.md`:

- **Secrets:** API keys only in **GCP Secret Manager**; never in repo or `NEXT_PUBLIC_*`.
- **Deploy:** `gcp-runtime-secrets.inc.sh` + deploy workflows must bind new secrets when introduced; `ops:secrets:verify:*` extended or documented.
- **Cost & quotas:** Rate limits, burst behavior, and $/request awareness for paid market data; idle Cloud Run + external API call volume.
- **Observability:** Structured logs with **provider id**, latency, symbol count — **no** raw keys or PII; optional metrics/alerts on 429/5xx from provider.
- **Rollback:** Feature flag or env switch to fall back to Yahoo without redeploying app logic (ideal).

---

## Current state (baseline)

| Surface | Today | Notes |
|--------|--------|--------|
| Next.js BFF | `getYahooFinance2()` scattered across modules (`market-data`, `yahoo-symbol-lookup`, `find-options`, `strategy-options/options-chain`, `expirations`, scanners, etc.) | Server-side only; not centralized. |
| Kotlin `atxfinance-backend` | `StrategyOptionsYahooClient` → Yahoo HTTP | Separate from TS; JVM SDK fits **here** if Massive used from Kotlin. |
| Frontend | `GET /api/market/symbol-quotes`, find-options APIs, strategy UI | Already pass-through; no change to **pattern** if DTOs stay stable. |

---

## Upfront decisions (answer before build)

Capture answers in this section or a linked doc so implementation does not stall on forks.

### D1 — Strategy / options execution path (BFF vs JVM)

| Option | Pros | Cons |
|--------|------|------|
| **A — Proxy via Next BFF only** | Single Massive/Yahoo integration in TS; one secret surface; fewer JVM deps; faster iteration | More CPU/network on **xfinance-core** Cloud Run; larger cold paths if chain is heavy |
| **B — Keep / extend Kotlin `atxfinance-backend`** | Offload chain work from Next; JVM SDK ([client-jvm](https://github.com/massive-com/client-jvm)); independent scaling | Two services to configure, key bind, deploy, observe; contract parity TS ↔ Kotlin |

**Decision:** A / B / hybrid (define: e.g. quotes in BFF, chain in Kotlin).

**If unblocked default:** **A** for speed and ops simplicity unless chain traffic is proven to dominate BFF.

---

### D2 — Primary vendor & fallback

| Option | Notes |
|--------|--------|
| **Yahoo primary, Massive optional** | Lowest change risk; Massive behind flag for staging tests |
| **Massive primary, Yahoo fallback** | Paid data path first; implement fallback mapping + error handling |
| **Massive only** (after cutover) | Simplest runtime; must accept Yahoo removal risk |

**Decision:** Primary = ___ · Fallback = ___ · **Dual-run period?** yes/no (how long).

---

### D3 — Market data entitlements (Massive plan reality)

Massive/Polygon tiers differ on **real-time vs delayed**, options depth, and **asset classes**.

**Decide:** Minimum plan name / features required (e.g. US equities delayed vs real-time options NBBO).  
**Blocks:** Response mapping and UI copy (“delayed 15m” disclaimers).

---

### D4 — Surfaces in v1 (scope control)

Which **must** use the new facade in the **first** shippable slice?

- [ ] `GET /api/market/symbol-quotes` (batch equity)
- [ ] Find-options (`symbol-snapshot`, hot scan, context)
- [ ] Strategy builder chain + expirations (`options-chain`, `expirations`)
- [ ] xChat `market_quote` / `yahoo_finance` tool path
- [ ] Scheduled scanners (`price-scanner`, etc.)
- [ ] Kotlin strategy routes (only if D1 ≠ A-only)

**Decision:** Check list + explicit **out of v1** items.

---

### D5 — API contract stability

| Option | Notes |
|--------|--------|
| **Strict** — No JSON shape changes for existing routes | Only swap implementation; OpenAPI/tests unchanged |
| **Additive** — Add `provider`, `dataDelay`, `asOf` fields | Safer UX; requires client tolerance + doc updates |

**Decision:** ___ · If additive, list **required** new fields.

---

### D6 — Caching & deduplication

| Question | Options |
|----------|---------|
| Server cache for quotes? | none / in-memory TTL / Redis (existing?) |
| Typical TTL | e.g. 15s / 60s / tiered by route |
| Cross-user dedup? | yes/no (same symbol, same second → one vendor call) |

**Blocks:** Cost model and 429 handling.

---

### D7 — Rate limits & abuse (BFF)

| Question | Decision |
|----------|----------|
| Max symbols per `symbol-quotes` request? | (today cap 28 — keep / change) |
| Per-user or per-IP throttling? | yes/no / which routes |
| Anonymous vs signed-in | Market routes are session-gated today — confirm stay that way |

---

### D8 — Observability & SLO

| Question | Decision |
|----------|----------|
| Log sample rate for symbol lists in prod? | full / truncated / hash only |
| Alert on provider error rate? | threshold ___ |
| Budget alert (vendor + GCP)? | who receives |

---

### D9 — xChat / product naming

| Question | Decision |
|----------|----------|
| Keep tool type **`yahoo_finance`** in personas while backend uses Massive? | yes (label debt) / migrate to **`market_quote`** or neutral slug |
| Citation strings / disclaimers | single template referencing “market data provider” vs vendor name |

**Blocks:** Persona YAML edits and prompt contracts if renaming.

---

### D10 — Kotlin backend fate (depends on D1)

If **D1 = A**: confirm whether Kotlin strategy endpoints are **deprecated**, **proxied to Next**, or **unchanged** for a period (dual path).

If **D1 = B**: confirm Massive key in **both** Secret Manager bindings (Next + JVM) or shared pattern.

---

### D11 — Local dev & CI

| Question | Decision |
|----------|----------|
| CI tests use **mocks only** (no live key)? | recommended yes |
| Local dev without Massive key | fall back to Yahoo / stub |

---

### D12 — Compliance & redistribution

Confirm Massive/Polygon **terms** allow your use (display in app, xChat summaries). Legal/product sign-off if required.

---

## Phases

### Phase 0 — Inventory & contracts (SRE: light; app: heavy)

**Steps**

1. **Document** all call sites that fetch prices/options (TS + Kotlin) in a short table (file → purpose).
2. **Define** normalized DTOs (equity quote, batch, optional chain slice) and **stable JSON** for existing routes (`/api/market/symbol-quotes`, `find-options/*`, strategy chain).
3. **SRE:** Confirm **no** new routes require public internet egress beyond what Cloud Run already allows (usually yes); note if VPC or static egress is required by vendor (usually not for HTTPS REST).

**Exit:** Written contract + inventory; OpenAPI `CURRENT_STATE` list if any route shape changes later.

---

### Phase 1 — Secrets & config model (SRE-owned)

**Steps**

1. **Name** env vars (example — adjust to Massive’s actual key names):
   - `MASSIVE_API_KEY` (or `POLYGON_API_KEY` during dual-brand window)
   - `MARKET_DATA_PROVIDER=yahoo|massive` (or `feature_flag` in Secret/Env only for ops)
2. **Add** secrets to **staging** Secret Manager first; validate with `npm run ops:secrets:verify:staging` after extending `scripts/ops/gcp-runtime-secrets.inc.sh` + `verify-gcp-runtime-secrets.sh`.
3. **Wire** `deploy-cloud-run*.yml` / `deploy-cloud-run-from-env.sh` `--set-secrets` bindings for `MASSIVE_API_KEY` (optional until Phase 3 — can be “present but unused”).
4. **Document** in `atx-docs/guides/deploy-and-ops.md` (or new `atx-docs/sre-ops/market-data-provider.md`): key names, staging vs prod, rotation procedure, **who pays** the Massive plan tier.
5. **Local dev:** `.env.example` documents optional keys with placeholders; **no** real keys.

**Exit:** Staging can deploy with secret present; verify script green; runbook updated.

---

### Phase 2 — Observability & guardrails (SRE-owned, app implements hooks)

**Steps**

1. **Logging contract:** `[market-data]` (or similar) prefix + fields: `provider`, `operation` (`quote_batch` | `options_chain` | …), `symbolCount`, `durationMs`, `status` (`ok` | `error`), `httpStatus` (vendor). No symbol lists > N in prod logs if noisy (or sample).
2. **Alerts (optional):** Error rate or latency SLO on provider calls; budget alert if vendor bills per request (GCP billing + vendor dashboard).
3. **Rate limiting:** If BFF risks stampede (many users, same symbol), document **server-side** dedup/cache TTL policy (app implements; SRE validates Redis/Memory limits if Redis used for cache).

**Exit:** Dashboard or log-based query works; on-call knows how to triage “quotes empty” vs “provider down.”

---

### Phase 3 — Next.js facade + Yahoo behind interface (app-owned; SRE reviews deploy)

**Steps**

1. Implement **`MarketDataFacade`** (or equivalent) in `src/modules/market-data/` — single entry for `getQuotes`, `getSymbolSnapshot` fields needed, options chain/expirations as required.
2. Move Yahoo calls **into** `YahooAdapter` implementing the interface.
3. Add **`MassiveAdapter`** (REST `fetch`, map response → normalized DTOs) gated by `MARKET_DATA_PROVIDER`.
4. **SRE:** Ensure Cloud Run service account + secrets sufficient; smoke test staging with `MARKET_DATA_PROVIDER=massive` on a **branch** or **staging** revision only.
5. **Tests:** Unit tests for mapping; integration tests with **mocked** HTTP (no live key in CI).

**Exit:** Staging can flip provider via env; Yahoo still works as default.

---

### Phase 4 — Kotlin backend alignment (backend + SRE)

**Steps**

1. Either **proxy** strategy/options through Next only (simpler ops, more BFF load) **or** add **Massive** client in Kotlin using [client-jvm](https://github.com/massive-com/client-jvm) / REST, mirroring normalized DTOs.
2. **SRE:** Second service (`atxfinance-backend`) needs same **Secret Manager** bindings + JVM memory/timeout review for larger JSON payloads.
3. Update `atx-docs/sre-ops/atxfinance-backend-http-api.md` if HTTP contract changes.

**Exit:** One story for “where does the chain come from” in prod (documented).

---

### Phase 5 — Cutover & rollback (SRE-led)

**Steps**

1. **Staging:** Full regression — portfolio quotes, xChat tools, find-options, strategy builder, scanners (if applicable).
2. **Prod:** Deploy with `MARKET_DATA_PROVIDER=yahoo` (no behavior change); then switch to `massive` in **revision** or env; monitor logs/alerts.
3. **Rollback:** Set env back to `yahoo` + redeploy; keep Yahoo path working until Massive is proven stable.

**Exit:** Runbook entry “Market data provider rollback” with exact env vars and health checks (`GET /api/health` + manual spot-check quotes).

---

## SRE checklist (quick reference)

- [ ] Secret names in `gcp-runtime-secrets.inc.sh` + verify scripts
- [ ] Staging/prod Secret Manager populated; sync script if copying from `.env.stage` / `.env.prod`
- [ ] Deploy workflows bind new secrets
- [ ] Docs: deploy-and-ops + optional `atx-docs/sre-ops/market-data-provider.md`
- [ ] Logging/metrics pattern for provider calls
- [ ] Cost/quotas understood; billing alerts if needed
- [ ] Rollback: env flip + revision

---

## Out of scope (unless product asks)

- Real-time WebSockets to browser (still BFF-mediated).
- Changing **xAI** tool names (`yahoo_finance`) — product/compliance; may remain as label while backend uses Massive.

---

## Related

- `.cursor/agents/sre.md` — Cloud Run, Secret Manager, observability, cost.
- `.cursor/plans/shared-context.md` — update **Live status** when provider flip is in progress.
- `atx-docs/guides/deploy-and-ops.md` — secret promotion model.
