# Cursor skill authoring (atxFinance)

Guide for **`.cursor/skills/<folder>/SKILL.md`**. The index is **[`README.md`](README.md)** — validated by **`npm run skills:lint`**.

## How to invoke skills

In Cursor chat or Composer, **name the skill explicitly**:

- *"Use the **generate-docs** skill and update DEVELOPMENT.md for this API change."*
- *"Run **test-commit-push** before we commit."*
- *"Apply **skill-covered-calls** for a TSLA weekly OTM setup."*
- *"Use **atxdesign-review-audit** on this diff."*

Subagents under **`.cursor/agents/*.md`** point at canonical skills — prefer those paths over duplicating long checklists in agent bodies.

## Folder layout

```
.cursor/skills/
  README.md                         # Index (every skill linked)
  skill-authoring.md                # This file (not a skill)
  OPTIONS_STRATEGY_SKILL_TEMPLATE.md
  <skill-folder>/
    SKILL.md                        # Required
    CHECKLIST.md                    # Optional
```

**Not skills:** reference markdown in **`atx-docs/`** (e.g. payoff chart spec under `atx-docs/design-system/xStrategyBuilder/`).

## Canonical frontmatter (required)

Every `SKILL.md` **must** start with YAML frontmatter:

```yaml
---
name: <kebab-case-folder-name>
description: One sentence + when to use (primary trigger for Cursor discovery).
---
```

**Rules**

- `name` should match the folder name (exceptions: legacy `xdesign-review-*` ids, `skill-learning-tutor` → `atx-learning-tutor`).
- Always include `description`.
- **Optional:** `id` (legacy alias), `skill_family` (e.g. `options-strategy`), `last_updated` (`YYYY-MM-DD` on playbooks).
- **`version:`** only for the design-review gate family (`atxdesign-review` currently `1.1.2`).

**Do not** embed app semver in skill bodies — use `package.json` / `src/lib/app-version.ts`.

## Recommended structure

1. `# Title`
2. `## Goal`
3. `## When to use` / workflow steps (numbered, with commands)
4. `## Guardrails` / `## Rules`
5. `## Output`
6. Pointer to `CHECKLIST.md` when checkboxes live there

Patterns in this repo:

- **SRE / deploy** — exact commands + rollback notes
- **Design review** — mandatory sequence + evidence template
- **Options playbooks** — `Core setup`, `Guardrails`, `Output format` + mirrored `CHECKLIST.md`
- **test-commit-push** — gates + link to `CHECKLIST.md`

## Versioning policy

| Artifact | Version? |
|----------|----------|
| `package.json` | Yes — shipped app |
| `atxdesign-review` (+ sub-skills) | Optional semver in frontmatter |
| Other skills | `last_updated` only on playbooks |
| `CHECKLIST.md` | Unversioned; update with behavior |

## Adding an options strategy skill

**One family** under `skill-*` (no parallel folder naming).

**Recipe**

1. Copy **[`OPTIONS_STRATEGY_SKILL_TEMPLATE.md`](OPTIONS_STRATEGY_SKILL_TEMPLATE.md)** → `skill-<name>/SKILL.md`.
2. Add `CHECKLIST.md` mirroring the three sections.
3. Add row to **`README.md`** § Options strategies.
4. Run **`npm run skills:lint`**.

**Mandatory scan work** uses **`skill-options-scan`** — not the playbooks.

**Narrative templates** (TSLA blocks): `atx-docs/design-system/xStrategyBuilder/options-core-narrative-templates.md`.

## When to create CHECKLIST.md

- Required gates (`test-commit-push`, `atxdesign-review*`)
- High-risk ops (deploy, key rotation, secrets)
- All options playbooks
- Any flow where “forgot one check” is a real failure mode

## Updating README.md

When adding, renaming, or removing a skill:

- Update the category table in **`README.md`**.
- Add to **Default skill policy** only if mandatory.
- Run **`npm run skills:lint`**.

## Lint

```bash
npm run skills:lint
```

Checks README ↔ folders, required frontmatter, no orphan non-skill directories.

## Related

- `AGENTS.md` — Project Cursor Skills
- `.cursor/agents/README.md` — persona ↔ skill map
- `test-commit-push/CHECKLIST.md` — ship gate including skills lint
- `generate-docs/SKILL.md` — docs parity when behavior changes

## Output when authoring

- Ready-to-write `SKILL.md` (+ `CHECKLIST.md` if needed)
- Which **`README.md`** section to update
- Reminder to run `skills:lint` and relevant validation gates
