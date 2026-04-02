# Release notes (operator / changelog)

Short, **newest-first** bullets tied to **`package.json`** semver. Append **one line** when you bump the app version (see **`.cursor/skills/test-commit-push/SKILL.md`** step 10 and **`.cursor/skills/test-commit-push/CHECKLIST.md`**).

Not user marketing copy — enough for deploy triage, support, and “what shipped in this image.”

## Entries

- **2.8.2** — **xChat markdown / citations:** `preprocessXchatMarkdown` on **`POST /api/xchat/ask`** + batch correlate (stored + API body match UI); **mid-line** bare `XF_CITE` / `XF_TOOL` wrap; **parse** strips `[\d+]` on slug and normalizes `xf_cite` / wire noise; **rejoin** cite-only line between `(` and a line starting with `)` so closing paren + chips render; react-markdown **inline `code`** text from children safely. **Tests:** `xchat-citations`, `xchat-markdown-preprocess`, `xchat-ask-route`.

- **2.8.1** — **xChat:** `POST /api/xchat/ask` prefers **request `personaId`** over **assigned** when `changePersonaEnabled` or `global_admin` (sidebar persona). **Portfolios:** `/portfolio/accounts/:id` resolves account by id across portfolios (fixes 404 when workspace cookie ≠ focused portfolio). **Nav:** product header — xOptions uses legacy **xStrategyBuilder** PNG glyph; **Hub** and **billing** icons removed; **`/xstrategybuilder`** → **`/xoptions`**. **Tests/docs:** `surface-policy` asserts `/xstrategybuilder` is not an app_user product prefix; guides updated (`xchat-personas.md`, `api-endpoints.md`).

- **2.8.0** — **xOptions (Choose contract / step 4):** Review order **summary bar** (limit/bid, breakeven, P(OTM) + gauge), narrative + disclaimer in an **info box**; **Ask xChat** beside **Open full option chain** — copies review plain text to clipboard and one-shot **`sessionStorage`** key `xf_xchat_pending_prompt_v1` (panel footnote excluded from handoff). **xChat:** composer **prefill** on load when that key is set; markdown preprocess **`repairAdjacentMangledXfInlineChips`** fixes mangled adjacent `` `XF_CITE` / `XF_TOOL` `` codes that leaked raw sentinels in prose. Choose-contract **strategy links** font size aligned with help links. **Tests:** `xoptions-order-preview`, `xchat-citations`, `xchat-markdown-preprocess` (pipeline). **Manual smoke before prod:** xOptions step 4 → Ask xChat → confirm composer text; spot-check citation chips after long Grok replies.

- **2.7.12** — Ops: **`GOOGLE_CLIENT_ID`** / **`GOOGLE_CLIENT_SECRET`** in Secret Manager — staging verify (`--with-google-oauth`), sync script (`ops:secrets:sync-google-oauth:*`), optional Cloud Run bindings in deploy workflows + `deploy-cloud-run-from-env.sh`; docs/agents updated.

- **2.7.11** — Tenant workspace: per-plan **`changePersonaEnabled`** + **`chatHistoryMax`** (admin UI, `/account/billing`, xChat picker + history depth); `npm run ops:users:reset-basic-super-agent` one-off (Basic + Super-Agent + `xchat_platform_settings`); admin portfolio routes scoped to session tenant/user with **`ADMIN_PORTFOLIOS_LIST_ALL`** break-glass.

- **2.7.10** — Ops/docs: `atx-docs/sre-ops/release-notes.md` + **Resources → Release notes** in **`.cursor/agents/sre.md`**; version bump checklist in **test-commit-push** (append a one-line entry here when shipping).

- **2.7.9** — xChat markdown pipeline: dedupe repeated bare `XF_CITE` / `XF_TOOL` lines and wrapped chip lines; normalize model footnote-style `[n]` after cites; preprocess order (inline dedupe → adjacent bare collapse → wrap → wrapped chip dedupe).
