---
id: development-devtest
name: development-devtest
description: Run atxFinance local dev test loop by restarting backend/frontend from fresh env and validating login/health quickly.
---

# Development DevTest (Global)

## Goal

Provide a repeatable local dev-test workflow that always reloads `.env` changes by terminating current services and restarting backend + frontend cleanly.

## Use This Skill When

- User says "restart and test again"
- `.env` values changed and app behavior looks stale
- OAuth or callback troubleshooting needs clean process state
- Default build task should re-launch two fresh terminals

## Standard Workflow

1. Stop stale service processes first.
2. Restart backend and frontend using task commands that reload `.env`.
3. Verify core routes quickly (`/api/health`, `/xchat`, auth redirect).
4. Report concrete pass/fail with next debugging step.

## Canonical Commands (atxfinance repo)

- Backend restart path:
  - `docker compose --env-file .env down && docker compose --env-file .env up`
- Frontend restart path:
  - Kill listeners on `3000/3001/3002`, remove `.next/dev/lock`, then run `next dev`

## Cursor Task Expectations

The repository task setup should include:

- `atxfinance-core: start backend` (background, dedicated panel)
- `atxfinance-core: start frontend` (background, dedicated panel)
- `atxfinance-core: start backend + frontend (default)` with parallel `dependsOn`

Default task must behave like a restart, not a no-op start.

## Quick Verification Checklist

- [ ] `GET /api/health` returns `status: ok`
- [ ] `GET /xchat` is reachable (`200`)
- [ ] `GET /api/auth/x/login` returns `307` redirect with expected `client_id` and callback
- [ ] No stale lock error: `.next/dev/lock`

## Guardrails

- Always use repo `.env` (local development default)
- Do not assume existing terminal state is correct
- Prefer deterministic restarts over partial process reuse
