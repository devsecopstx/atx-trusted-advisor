# PLAN — backlog, gaps, design TBD

Tracked follow-ups from doc/ops reviews. **Not blocking** staging or merge unless explicitly promoted to a ticket.

## Documentation & process

| Status | Item |
|--------|------|
| **TODO** | **CONTRIBUTING.md** — Optional one-liner: new session-facing product APIs should be listed in `DEVELOPMENT.md` § API and linked from `README.md` when user-visible. |
| **TODO** | **test-commit-push CHECKLIST** — Optional checkbox: “Deferred items captured in `docs/PLAN.md` (if any) reviewed or consciously skipped.” |
| **Design TBD** | **User-facing privacy / retention** — Short note for app_user **Feedback** (`POST /api/feedback`): what is stored (Slack vs logs only), retention, and whether copy in the modal should link to a policy page. |

## Testing & QA

| Status | Item |
|--------|------|
| **TODO** | **E2E / Playwright** — Smoke for app_user header: profile popover, logout, feedback modal submit (happy path + unauthenticated). |
| **Design TBD** | Where E2E lives (`tests/e2e` vs CI job) and whether it runs on every PR or nightly. |

## Product / UX

| Status | Item |
|--------|------|
| **Design TBD** | **Plans landing** (signed-in, not yet approved) — Header is minimal vs full `AppUserApprovedHeader`; decide if parity (e.g. logout only) is desired. |
| **Design TBD** | **Watchlist** (`/watchlist`) — Stub only; define data model + API surface vs portfolio watchlist endpoints. |

## OpenAPI / API inventory

| Status | Item |
|--------|------|
| **TODO** | When adding handlers under `src/app/api/**/route.ts`, keep `current-state.ts` + overrides in sync (existing CONTRIBUTING rule); consider a CI grep or script later. |

---

*Last aligned with doc gap review — extend this file instead of scattering TODOs across runbooks.*
