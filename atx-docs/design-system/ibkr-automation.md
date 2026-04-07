Feature: IBKR Account Trades + Automation Integration

**Roadmap:** Priority **200** in [`PLAN.md`](../PLAN.md) (product backlog).

Goal

Enable secure, user-authorized connection to Interactive Brokers (IBKR) accounts for real-time account data, manual order placement, and configurable automation (rules-based or strategy-driven order execution). Support both live and paper trading. Prioritize security, compliance, risk controls, and auditability.

Scope

- Read: account balances, positions, orders, executions
- Write: place/modify/cancel orders (market, limit, stop, bracket, OCA, advanced algos)
- Automation: rule engine for conditional orders, position sizing, stop management
- Out of scope (Phase 1): full algo backtesting engine, third-party strategy marketplace

## Tech stack (this repo)

- **Language:** TypeScript (Next.js App Router server runtime; optional Spring parity later for BFF-proxied paths).
- **Auth:** Existing xFinance session + tenant/user model; IBKR credentials must never live in client bundles.
- **Preferred IBKR path (Phase 1 decision):** **Client Portal Web API** (HTTPS REST) for simpler deployment than TWS/IB Gateway for initial read-only and order-confirm flows. **TWS API + ib_insync** (or IB Gateway) remains an alternative if sub-second latency or local Gateway is required — document an explicit ADR before switching.

**Implementation pointer:** `src/modules/ibkr-integration/README.md` (architecture + security checklist).

### Phase 2 status (shipped in app **3.2.1+**)

- [x] Consent recorded in Mongo (`ibkr_user_consents`) — no passwords.
- [x] Session material: httpOnly **`xf_ibkr_cp_session`** (AES-GCM sealed with app `AUTH_SECRET`); optional env session for **operator smoke only** (`IBKR_USE_ENV_SESSION_COOKIE` + `IBKR_CLIENT_PORTAL_SESSION_COOKIE`).
- [x] Companion httpOnly **`xf_ibkr_cp_issued`** (ms timestamp when session stored) for re-auth UX — app **3.3.0**.
- [x] `GET /v1/api/portfolio/accounts` via server-side fetch (`fetchIbkrPortfolioAccounts`).
- [x] User-facing page `/account/integrations/ibkr` (connect, consent, test accounts when gateway + session are available).
- [x] **`GET /api/integrations/ibkr/status`** exposes **`oauthBrokerSsoAvailable: false`**, **`sessionHint`**, **`sessionCookieMaxAgeSec`**, **`sessionIssuedAtMs`** — app **3.3.0** (re-auth guidance; still no broker OAuth in-app).
- [ ] Token refresh / full OAuth-style broker SSO (future — CP remains gateway + cookie today).

### Phase 1 status (foundation — app **3.2.0+**)

- Module folder with **types**, **optional env parsing** (`IBKR_*`, isolated from core `getEnv()`), **sliding-window rate limiter**, **retry helper**, **Phase-1 stub client** (`client-phase1.ts`, `apiReachable: false` — kept for typing/tests; **live reads** use `client-portfolio.ts` + sealed session cookie when `IBKR_ENABLED` is on).
- **Runtime:** When `IBKR_ENABLED` is unset/false, IBKR routes stay disabled and Merrill/Fidelity CSV import is unchanged.
- **Shipped with Phase 2 (3.2.1):** Next API routes under `/api/integrations/ibkr/*`, Mongo **`ibkr_user_consents`**, UI **`/account/integrations/ibkr`** — see Phase 2 checklist below.

Risk & Compliance Posture (non-negotiable)

- All trading actions require explicit user consent
- Paper trading mandatory before live
- Full audit log of every API call and order
- Rate-limit + circuit-breaker logic
- No hard-coded credentials ever

Phase 1: Research & Foundation (1–2 days)

- [x] Confirm tech stack and preferred IBKR API (**Client Portal REST** default — see above).
- [x] Create **`ibkr-integration`** module — see `src/modules/ibkr-integration/`.
- [x] Environment variables (`IBKR_ENABLED`, `IBKR_PAPER`, `IBKR_MAX_REQUESTS_PER_MINUTE`, `IBKR_CLIENT_PORTAL_BASE_URL`) — documented in `.env.example`.
- [x] Rate limiter + retry policy (unit-tested).
- [ ] Set up paper trading account testing environment (operator / external IBKR account).
- [x] Define data models: `IbkrAccount`, `IbkrPosition`, `IbkrOrder`, `IbkrExecution`, `IbkrAutomationRule` (TypeScript types).
- [x] Deliverable: **`src/modules/ibkr-integration/README.md`** (architecture + security checklist).

Phase 2: Authentication & Session Management (2–3 days)

- [x] Client Portal session via **gateway cookie** (sealed httpOnly cookie or explicit operator env — not passwords in Mongo).
- [x] Secure credential storage (no IBKR password field; session blob not stored in Mongo).
- [ ] Token refresh, expiry, and re-auth automation (still manual re-paste or env rotation when CP session expires).
- [x] User consent flow + copy on `/account/integrations/ibkr` and `POST /api/integrations/ibkr/consent`.
- [x] Multiple IBKR accounts per response via `portfolio/accounts` list (per-user session still one CP session at a time).
- [x] Deliverable: `GET /api/integrations/ibkr/accounts` + UI “Test: list accounts”.

Phase 3: Account & Portfolio Data (2 days)

**Shipped (app ≥3.3.0)** — read path, no WebSocket yet:

- [x] Per-account **summary** (`GET /v1/api/portfolio/{accountId}/summary`) and **positions** (`portfolio2/…/positions` with **`positions/0` fallback**).
- [x] **Orders** (`GET /v1/api/iserver/account/orders`) and **executions** (IBKR **trades**, `GET /v1/api/iserver/account/trades`) after **`POST /v1/api/iserver/account`** account switch.
- [x] **Account allowlist** — every `{accountId}` route verifies the id appears in **`portfolio/accounts`** for the same CP session.
- [x] **Next routes:** `GET …/accounts/{accountId}/snapshot` (bundled), plus granular `summary`, `positions`, `orders`, `executions`; **`[ibkr/audit]`** logs (masked ids).
- [x] **Read-only UI** on `/account/integrations/ibkr` (JSON snapshot).
- [ ] Real-time updates via WebSocket (Client Portal) or TWS callbacks.
- [ ] Map IBKR contract IDs to your internal symbols; response caching / pacing polish.
- Deliverable (met for MVP read): operator can validate paper gateway + snapshot; full “dashboard” polish can follow.

Phase 4: Market Data & Contract Handling (2 days)

- Request live quotes, market depth (if needed).
- Contract lookup service (symbol → IBKR contract details).
- Handle multi-currency and international symbols.
- Deliverable: Reusable getMarketData(contract) and resolveContract(symbol) helpers.

Phase 5: Order Placement & Trade Execution (3–4 days)

**Not started — no live order POST routes in xFinance until** paper-first gates, risk review, and audit requirements are satisfied (see Phase 7).

- Build order builder supporting:
  - Market / Limit / Stop / Stop-Limit / Trail
  - Bracket / OCA / One-Cancels-All
  - IBKR algos (VWAP, TWAP, etc.)
- Preview order before submission (IBKR /iserver/order/confirm).
- Place, modify, cancel orders with full response parsing.
- Real-time order status callbacks.
- Deliverable: Manual trade ticket that routes through IBKR with confirmation UI.

Phase 6: Automation Engine (4–6 days)

- Create rule engine:
  - Conditions (price, % change, technical indicator, time-based)
  - Actions (place order, adjust stop, close position)
- Support scheduled + event-driven triggers.
- Persist user automation rules (with version history).
- Add kill-switch (global and per-rule).
- Position sizing logic (fixed $, % of equity, risk-based).
- Deliverable: “Automations” page where users create, enable/disable, and monitor rules.

Phase 7: Risk Management & Safeguards (3 days)

- Pre-trade checks:
  - Max position size
  - Daily loss limit
  - Margin cushion
- Circuit breakers on rapid order volume.
- Notification system for every automated action.
- Full audit trail (who, what, when, why).
- Deliverable: Risk dashboard + automated alerts.

Phase 8: UI/UX + User Controls (2–3 days)

- Secure “IBKR Accounts” settings page.
- Connect/disconnect flow with status.
- Trade history synced from IBKR.
- Automation rule builder UI.
- Clear disclaimers on every trade/automation screen.

Phase 9: Testing, Monitoring & Observability (3–4 days)

- Unit + integration tests (paper account).
- End-to-end test suite with simulated market moves.
- Logging + monitoring (Sentry + custom audit log).
- Performance metrics (latency, success rate).
- Security review (credential handling, rate limits).

Phase 10: Production Hardening & Rollout

- Rate limiting per user.
- Compliance export capability (for tax reporting).
- Phased rollout: opt-in flag.
- Documentation for users on risks of automation.
- Post-launch monitoring plan.

Success Criteria

- User can connect IBKR account in < 60 seconds
- Manual trades execute reliably
- Automation rules fire only when intended
- Zero credential exposure
- Full audit trail for every action

## What's next (engineering)

**Phase 3 read path is shipped** (app **≥3.3.0**): snapshot + granular routes, allowlist, audit logs, read-only UI, session issued-at + status hints. **Still open:** Phase 1 paper **operator environment** checkbox; Phase 2 **OAuth / token refresh**; Phase 3 **WebSocket**, **contract-id mapping**, **caching**.

**Phase 4 — market data & contracts:** quotes / depth / `resolveContract(symbol)` (see Phase 4 list above).

**Phase 5 — orders:** preview (`/iserver/order/confirm`) then place/modify/cancel **only after** risk / paper / audit gates; **no** live order POST in production until explicitly signed off.

Official references (bookmark):

- [Client Portal Web API](https://www.interactivebrokers.com/en/index.php?f=50476)
- [TWS API](https://interactivebrokers.github.io/tws-api/) (if TWS path is chosen later)
