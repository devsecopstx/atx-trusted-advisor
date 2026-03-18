---
id: fix-current-file
name: fix-current-file
description: Fix lint, type, and straightforward logic issues in the current file with minimal collateral change.
---

# Fix Current File

## Goal

Make the current file pass lint and type checks while preserving intent and style.

## Use This Skill When

- The active file has diagnostics
- A refactor introduced local regressions
- You want a focused single-file cleanup

## Workflow

1. Read the file and diagnostics.
2. Fix syntax, typing, and lint issues in priority order.
3. Keep changes local and avoid unrelated edits.
4. Re-check diagnostics for the same file.

## Output

- Issues fixed
- Any unresolved diagnostics
- Suggested follow-up if cross-file changes are required
