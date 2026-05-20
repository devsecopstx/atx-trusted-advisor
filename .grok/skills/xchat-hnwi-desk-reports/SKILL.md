---
name: xchat-hnwi-desk-reports
description: HNWI Desk Report v2.1 templates, prompt packaging, and server-side desk report add-on behavior for finance-advisor xChat users. Use for composer quick actions, prompt_templates seed, xchat-hnwi-v21-desk-report.ts, or any "income-ideas / concentration / wheel scan" desk report work. Trigger: Desk Report, v2.1, hnwiPromptTemplateV21Slug, income ideas, wheel scan.
skill_family: xchat-hnwi
last_updated: 2026-05-20
---

# xchat-hnwi-desk-reports

Specialist for the **HNWI / Investment Advisor desk report experience** (the premium "show me ideas on my book" flow in xChat).

## v2.1 Prompt Templates (user-facing quick actions)

Defined in `atx-docs/xchat/hnwi-options-prompts-v2.1.md` and seeded to Mongo `prompt_templates` (global, tenantId null) via `seed:prompt-templates-v21` (runs in seed:admin unless skipped).

Current canonical slugs / cards:

1. **Concentration** — Review top notionals, sector skew; suggest diversify or hedge. Use workspace holdings when visible.
2. **Wheel / covered call / CSP scan** — Up to 3 ideas from holdings + watchlist with strike/expiry/premium/ROC/assignment risk. Return as **formatted markdown desk report** (headings + table), using the desk field contract (not raw JSON).
3. **Protective puts** — Checklist for largest equity lines (tenor, strike vs cost, rolling). Workspace positions when visible.
4. **Watchlist pass** — Themes, overlap with holdings, top 3 names for an options pass this week.
5. **Options desk snapshot** — Scan options from holdings + watchlist.

Each template merges at runtime with the user's current workspace snapshot (via `GET /api/app-user/xchat/prompt-template-v21/{slug}?portfolioId=...`).

## Server Desk Report v2.1 Add-on

When a v2.1 template (or legacy income-ideas path) is active, the server injects the **`Desk Report v2.1`** system instructions (see `src/modules/xchat/xchat-hnwi-v21-desk-report.ts`).

Required output shape (Markdown):

- **Executive snapshot**
- **Ideas** (pipe table or structured list with desk fields: strategy, symbol, strike, expiry, premium, sizing, ROC, risk notes)
- **Risk & disclaimer** (pulls the appropriate compliance language)

The client composer shows these as "HNWI Desk v2.1" quick-action library cards. Optional `hnwiPromptTemplateV21Slug` on the ask body selects one.

## Integration Points

- **Persona side**: finance-advisor + advisor personas should be compatible (the add-on is orthogonal to persona system prompt but the RAG contracts still apply).
- **Tool usage**: The report flows still obey the same `atx_function` + `yahoo_finance` + RAG split. Prefer one workspace snapshot call + targeted quotes/scans.
- **Watchlist/holdings formatting**: Spot + Target entry in USD (`spotPriceDisplay`, `targetEntryNotional100xUsdDisplay`) for direct "show my watchlist" or desk rows.
- **History / remote chain**: The slug becomes part of the remote fingerprint when `XCHAT_USE_REMOTE_HISTORY=true`.

## Guardrails Specific to Desk Reports

- Always produce the three required sections; never return bare JSON for the "Ideas" portion in the final user-visible turn.
- Use real workspace data (via tools/preload) — do not hallucinate positions or notionals.
- Apply the full compliance disclaimers (universal + options/tax as appropriate) in the Risk & disclaimer section.
- Keep the report concise and actionable for a busy IA/HNWI user scanning multiple ideas.
- For scans: respect position sizing / risk budget rules from the user's stated profile or portfolio prefs (never exceed book-level or ticker-level caps without explicit call-out).

## When Extending or Debugging

1. Update the source narrative in `atx-docs/xchat/hnwi-options-prompts-v2.1.md`.
2. Sync the defaults in `src/modules/xchat/prompt-templates-v21-defaults.ts`.
3. If the server add-on shape changes, update the validation test and this skill.
4. After seed changes, run the prompt-template smoke (see xchat validation patterns in Cursor skill).
5. Test both as global_admin (full workspace) and as a viewer/operator app_user (limited visibility).

## Key Files

- `atx-docs/xchat/hnwi-options-prompts-v2.1.md`
- `src/modules/xchat/xchat-hnwi-v21-desk-report.ts`
- `src/modules/xchat/prompt-templates-v21-defaults.ts`
- `atx-docs/rag-collection/atx-response-guidelines/compliance-disclaimers.md` (for the footer block)
- `tests/integration/` (hnwi-prompt-template tests)

## Output Contract for This Skill

When asked to implement or fix a desk report flow, return:
- Exact Markdown structure the model must emit.
- The merged system instruction diff.
- Workspace snapshot fields that must be preloaded.
- Compliance language placement.
- Test commands (local ask + staging parity).
