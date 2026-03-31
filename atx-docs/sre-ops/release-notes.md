# Release notes (operator / changelog)

Short, **newest-first** bullets tied to **`package.json`** semver. Append **one line** when you bump the app version (see **`.cursor/skills/test-commit-push/SKILL.md`** step 10 and **`.cursor/skills/test-commit-push/CHECKLIST.md`**).

Not user marketing copy — enough for deploy triage, support, and “what shipped in this image.”

## Entries

- **2.7.11** — Tenant workspace: per-plan **`changePersonaEnabled`** + **`chatHistoryMax`** (admin UI, `/account/billing`, xChat picker + history depth); `npm run ops:users:reset-basic-super-agent` one-off (Basic + Super-Agent + `xchat_platform_settings`); admin portfolio routes scoped to session tenant/user with **`ADMIN_PORTFOLIOS_LIST_ALL`** break-glass.

- **2.7.10** — Ops/docs: `atx-docs/sre-ops/release-notes.md` + **Resources → Release notes** in **`.cursor/agents/sre.md`**; version bump checklist in **test-commit-push** (append a one-line entry here when shipping).

- **2.7.9** — xChat markdown pipeline: dedupe repeated bare `XF_CITE` / `XF_TOOL` lines and wrapped chip lines; normalize model footnote-style `[n]` after cites; preprocess order (inline dedupe → adjacent bare collapse → wrap → wrapped chip dedupe).
