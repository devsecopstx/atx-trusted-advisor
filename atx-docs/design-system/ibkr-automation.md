Feature: IBKR Account Trades + Automation Integration
Goal
Enable secure, user-authorized connection to Interactive Brokers (IBKR) accounts for real-time account data, manual order placement, and configurable automation (rules-based or strategy-driven order execution). Support both live and paper trading. Prioritize security, compliance, risk controls, and auditability.
Scope

Read: account balances, positions, orders, executions
Write: place/modify/cancel orders (market, limit, stop, bracket, OCA, advanced algos)
Automation: rule engine for conditional orders, position sizing, stop management
Out of scope (Phase 1): full algo backtesting engine, third-party strategy marketplace

Tech Assumptions (update if your stack differs)

Language: [Your primary language, e.g. TypeScript/Python]
Existing auth: user accounts with secure storage (e.g. encrypted DB or vault)
Preferred IBKR path: Client Portal Web API (REST) for simplicity OR TWS API + ib_insync if low-latency required. Decide in Phase 1.

Risk & Compliance Posture (non-negotiable)

All trading actions require explicit user consent
Paper trading mandatory before live
Full audit log of every API call and order
Rate-limit + circuit-breaker logic
No hard-coded credentials ever

Phase 1: Research & Foundation (1–2 days)

Confirm tech stack and preferred IBKR API (Client Portal REST vs TWS API + ib_insync).
Review official docs (bookmark):
Client Portal Web API
TWS API (if chosen)

Create ibkr-integration module/folder with:
API client wrapper
Environment variables (IBKR_PAPER=true, client ID, etc.)
Rate limiter + retry policy

Set up paper trading account testing environment.
Define data models: IbkrAccount, Position, Order, Execution, AutomationRule.
Deliverable: README.md with architecture decision + security checklist.

Phase 2: Authentication & Session Management (2–3 days)

Implement OAuth-style session flow for IBKR (Client Portal uses session tokens; TWS uses Gateway).
Secure credential storage (never store passwords in DB).
Handle token refresh, expiry, and re-auth.
Add user consent screen: “Connect IBKR Account – View balances, place trades, automate orders”.
Support multiple accounts per user.
Deliverable: Working connection test that fetches /portfolio/accounts or equivalent.

Phase 3: Account & Portfolio Data (2 days)

Fetch and cache:
Account summary (NAV, buying power, margin)
Positions
Open orders
Executions history

Real-time updates via WebSocket (Client Portal) or TWS callbacks.
Map IBKR contract IDs to your internal symbols.
Add error handling for pacing violations.
Deliverable: Dashboard view showing live IBKR portfolio synced to app.
Phase 4: Market Data & Contract Handling (2 days)

Request live quotes, market depth (if needed).
Contract lookup service (symbol → IBKR contract details).
Handle multi-currency and international symbols.
Deliverable: Reusable getMarketData(contract) and resolveContract(symbol) helpers.

Phase 5: Order Placement & Trade Execution (3–4 days)

Build order builder supporting:
Market / Limit / Stop / Stop-Limit / Trail
Bracket / OCA / One-Cancels-All
IBKR algos (VWAP, TWAP, etc.)

Preview order before submission (IBKR /iserver/order/confirm).
Place, modify, cancel orders with full response parsing.
Real-time order status callbacks.
Deliverable: Manual trade ticket that routes through IBKR with confirmation UI.

Phase 6: Automation Engine (4–6 days)

Create rule engine:
Conditions (price, % change, technical indicator, time-based)
Actions (place order, adjust stop, close position)

Support scheduled + event-driven triggers.
Persist user automation rules (with version history).
Add kill-switch (global and per-rule).
Position sizing logic (fixed $, % of equity, risk-based).
Deliverable: “Automations” page where users create, enable/disable, and monitor rules.

Phase 7: Risk Management & Safeguards (3 days)

Pre-trade checks:
Max position size
Daily loss limit
Margin cushion

Circuit breakers on rapid order volume.
Notification system for every automated action.
Full audit trail (who, what, when, why).
Deliverable: Risk dashboard + automated alerts.

Phase 8: UI/UX + User Controls (2–3 days)

Secure “IBKR Accounts” settings page.
Connect/disconnect flow with status.
Trade history synced from IBKR.
Automation rule builder UI.
Clear disclaimers on every trade/automation screen.

Phase 9: Testing, Monitoring & Observability (3–4 days)

Unit + integration tests (paper account).
End-to-end test suite with simulated market moves.
Logging + monitoring (Sentry + custom audit log).
Performance metrics (latency, success rate).
Security review (credential handling, rate limits).

Phase 10: Production Hardening & Rollout

Rate limiting per user.
Compliance export capability (for tax reporting).
Phased rollout: opt-in flag.
Documentation for users on risks of automation.
Post-launch monitoring plan.
Success Criteria

User can connect IBKR account in < 60 seconds
Manual trades execute reliably
Automation rules fire only when intended
Zero credential exposure
Full audit trail for every action

Next Step for Cursor
Start with Phase 1. Ask me for clarification on tech stack or specific API choice before proceeding.