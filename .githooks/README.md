# Git hooks (optional)

Convention for **Cursor agent** commits lives in **`.cursor/skills/test-commit-push/SKILL.md`** (step 11). Hooks do not replace that doc; they only add optional reminders or strict checks.

## Enable (per clone)

From the repo root:

```bash
git config core.hooksPath .githooks
```

`core.hooksPath` is local — not committed — so each developer opts in.

## `prepare-commit-msg` (CLI prefix)

Automatically prepends a **subject prefix** so plain `git commit -m "broker fix"` becomes e.g. `chore: aTx⚡ broker fix` without typing the prefix.

**Prefix order:**

1. Environment variable **`ATX_COMMIT_PREFIX`** (if set — use empty `ATX_COMMIT_PREFIX=` to skip prepending when you also want to bypass the file default).
2. Else first line of **`.githooks/commit-prefix`** (tracked file; edit for your default).
3. Else **`chore: aTx⚡ `** (trailing space before your summary).

**When it runs:** only for **`git commit -m`** / **`git commit -F`** (Git passes source `message`). Interactive **`git commit`** (opens editor) is **unchanged** so the template stays normal — type `chore: aTx⚡ …` yourself or paste.

**Skips:** any source other than `message` (merge, squash, `template`, amend reuse, etc.); subjects that already start with the chosen prefix or with `chore: aTx⚡`.

**One-off without prefix:** `ATX_COMMIT_NO_PREFIX=1 git commit ...`

**Examples:**

```bash
git config core.hooksPath .githooks
git commit -m "tighten mongo healthcheck"   # → chore: aTx⚡ tighten mongo healthcheck
ATX_COMMIT_PREFIX="fix: " git commit -m "cors"   # → fix: cors
ATX_COMMIT_NO_PREFIX=1 git commit -m "chore: upstream sync"
```

## `commit-msg`

- On branches named `agent/*`, `cursor/*`, or `release/*`, if the first line does **not** start with **`chore: aTx⚡`**, the hook prints a **hint** to stderr and still allows the commit.
- Merge and revert commits are skipped.
- **Strict mode (optional):** `XFINANCE_ENFORCE_CURSOR_COMMIT=1 git commit ...` fails the commit if the subject does not start with **`chore: aTx⚡`** on those branches.

## Why not “instead of” skills?

- Agents and reviewers need the written convention in **`.cursor/`**; hooks are not visible in PR text.
- Many commits are **human-authored** (`feat:`, `fix:`, `chore(release):`, merge commits). A default hook that **requires** `chore: aTx⚡` on every branch would break normal workflow, so enforcement stays opt-in and scoped to agent/cursor/release branches.
