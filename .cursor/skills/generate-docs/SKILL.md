---
id: generate-docs
name: generate-docs
version: 2.0.0
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

## Baseline Docs Set (xFinance Core)

Default to maintaining this minimum docs set:

- `README.md`: product scope + fast local start.
- `DEVELOPMENT.md`: full setup, required env keys, runbooks, API map.
- `.env.example`: safe placeholders and required key names only.
- `AGENTS.md`: operator-centric commands/checks and troubleshooting.
- `CONTRIBUTING.md`: local validation + PR quality gates.

When introducing new subsystems, prefer extending `DEVELOPMENT.md` and linking from `README.md` instead of creating scattered top-level docs.

## Output

- Docs updated/created
- Coverage gaps still open
- Recommended doc owners/follow-ups
- TODO: remove dependency on global Cursor skills; keep docs operations project-local.
