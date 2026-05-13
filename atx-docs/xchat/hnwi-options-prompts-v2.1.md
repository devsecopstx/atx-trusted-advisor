# HNWI options prompts — Desk Report v2.1

Canonical copy for **HNWI / RIA-style** xChat workspace library cards (`GET /api/app-user/xchat/prompt-template-v21/{slug}`) and Mongo seed rows (`prompt_templates`, `tenantId: null`). Runtime defaults live in `src/modules/xchat/prompt-templates-v21-defaults.ts` (keep in sync with this doc).

**Output contract:** every v2.1 turn also receives the server system add-on **`Desk Report v2.1`** (see `src/modules/xchat/xchat-hnwi-v21-desk-report.ts`) requiring Markdown sections **Executive snapshot**, **Ideas** (with a pipe table), and **Risk & disclaimer**.

---

## 1 — Concentration

Review concentration: top notionals, sector skew, one diversify or hedge idea. Use workspace holdings if visible.

---

## 2 — Wheel / covered call / CSP scan

From holdings + watchlist: up to three covered_call, wheel, or cash_secured_put ideas with strike, expiry, premium, contract sizing, annualized ROC, and assignment risk — answer as a formatted markdown desk report (headings and/or a table), using the desk field contract for each idea (not raw JSON only).

---

## 3 — Protective puts

Protective put checklist for largest equity lines: tenor, strike vs cost, rolling — use workspace positions when visible.

---

## 4 — Watchlist pass

Summarize workspace watchlist: themes, overlap with holdings, top three names for an options pass this week.

---

## 5 — Options desk snapshot

Scan my options from holdings + watchlist.
