# Git hooks (optional)

Convention for **Cursor agent** commits lives in **`.cursor/skills/test-commit-push/SKILL.md`** (step 11). Hooks do not replace that doc; they only add optional reminders or strict checks.

## Enable (per clone)

From the repo root:

```bash
git config core.hooksPath .githooks
```

`core.hooksPath` is local — not committed — so each developer opts in.

## `commit-msg`

- On branches named `agent/*`, `cursor/*`, or `release/*`, if the first line does **not** start with **`chore: aTx⚡`**, the hook prints a **hint** to stderr and still allows the commit.
- Merge and revert commits are skipped.
- **Strict mode (optional):** `XFINANCE_ENFORCE_CURSOR_COMMIT=1 git commit ...` fails the commit if the subject does not start with **`chore: aTx⚡`** on those branches.

## Why not “instead of” skills?

- Agents and reviewers need the written convention in **`.cursor/`**; hooks are not visible in PR text.
- Many commits are **human-authored** (`feat:`, `fix:`, `chore(release):`, merge commits). A default hook that **requires** `chore: aTx⚡` on every branch would break normal workflow, so enforcement stays opt-in and scoped to agent/cursor/release branches.
