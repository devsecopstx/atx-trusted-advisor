---
id: generate-docs
name: generate-docs
version: 2.1.0
description: Update and generate concise, accurate docs for changed systems, APIs, and runbooks.
---

# Generate Docs

## Goal

Keep project documentation aligned with code changes and operational reality.

## Use This Skill When

- Features changed but docs lag behind
- New APIs/workflows need examples
- Runbooks need clearer setup or troubleshooting steps

## Workflow

1. Identify changed behavior and impacted docs.
2. Update existing docs before creating new ones.
3. Add concrete examples, constraints, and failure modes.
4. Keep structure scannable and concise.
5. Validate commands and paths in docs.
6. Keep version references consistent across docs and UI surfaces.

## Baseline Docs Set (atxFinance Core)

Default to maintaining this minimum docs set:

- `README.md`: product scope + fast local start.
- `DEVELOPMENT.md`: full setup, required env keys, runbooks, API map.
- `.env.example`: safe placeholders and required key names only.
- `AGENTS.md`: operator-centric commands/checks and troubleshooting.
- `CONTRIBUTING.md`: local validation + PR quality gates.

When introducing new subsystems, prefer extending `DEVELOPMENT.md` and linking from `README.md` instead of creating scattered top-level docs.

## Version Consistency Rules

- Canonical app version is `package.json`.
- Admin footer version must resolve via `src/lib/app-version.ts` (no hardcoded version strings in UI).
- If a release version changes, verify docs and runbooks do not retain stale version literals.

## Local Skill Sync

- Keep docs-ops guidance aligned with:
  - `.cursor/skills/test-commit-push/SKILL.md`
  - `.cursor/skills/test-commit-push/CHECKLIST.md`
  - `AGENTS.md`

## Output

- Docs updated/created
- Coverage gaps still open
- Recommended doc owners/follow-ups
- TODO: remove dependency on global Cursor skills; keep docs operations project-local.
