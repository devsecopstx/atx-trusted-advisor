# xFinance Branding Review — Latest Style Changes

Review against **`.cursor/rules/xfinance-branding.mdc`** (expert pass).

**Product decision:** Keep the current **AtxFinanceLogo** (mark + "xFinance") and **MarketingHero** for the landing. Do **not** add a separate full-page hero with inline ⚡ + "xF" + "xFinance Coach" + custom CTAs; that treatment was reverted and is not desired.

---

## 1. Critical: “Never use aTx anymore — kill it”

**Rule:** *Strict Rules — Never use "aTx" anymore — kill it.*

**Current code:**

| Location | Current | Rule |
|----------|--------|------|
| `src/app/ui/atxfinance-logo.tsx` | `AtxFinanceMark` renders SVG text **"aTx"** in gain-green | Primary icon must be **⚡ + stylized "xF"** |
| `src/app/xchat/page.tsx` | `aria-label="aTX Finance — xChat home"` | No "aTx" / "aTX" in copy or a11y |
| Admin topbar, login, personas, `MarketingHero` | Use `AtxFinanceLogo` → mark is "aTx" | Same as above |

**Action:** Replace the logo mark with **lightning + "xF"** (or "xF" only in accent green). Update all aria-labels to **"xFinance — xChat home"** (or equivalent) with no "aTx"/"aTX". Use the rule’s primary icon (⚡ + xF) in shared logo and xChat header.

---

## 2. Hero (when used) vs rule

If the new landing hero (⚡ + xF, tagline, $2/hr) is re‑introduced and shown to guests:

| Item | Rule | Current / note |
|------|------|-----------------|
| Background | `#050505` | ✅ `bg-[#050505]` |
| Primary icon | ⚡ + "xF" | ✅ Lightning + "xF" |
| Tagline | "No Atoms Moved. Just Gains Earned." | ✅ Copy correct |
| Tagline typography | `font-black uppercase tracking-[4px] text-emerald-400` | Use uppercase + `tracking-[4px]` for tagline |
| Subline | "Cheapest xFinance at $2/hr • Options Profits Powered by Grok" | Add **"Options Profits Powered by Grok"** (rule subline) |
| $2/hr | In emerald-400 + tooltip "Cheapest xFinance on earth — pay only for what you use." | Add `title` (or `aria-describedby`) on $2/hr and primary CTA |
| Accent green | `#22c55e` (rule) | Tailwind `emerald-400` is `#34d399`. For exact rule color use `text-[#22c55e]` or a token. |
| Product hierarchy | xFinance, xChat, xCoach, xMoney • coming soon | ✅ Footer list aligns |
| CTAs | Buttons/links to xChat and xMoney | Prefer `<Link href="/xchat">` etc. so CTAs work |

---

## 3. Design system vs rule green

- **Rule:** Accent green `#22c55e` (neon gains).
- **Design system:** `--xf-gain-green: #39ff14` (atxfinance-brand-kit.css).

Decide a single source of truth: either the rule’s `#22c55e` for the new “xFinance” hero/brand, or keep `#39ff14` for existing atxfinance surfaces. If both stay, document which is used where (e.g. “hero / marketing = #22c55e”, “admin / charts = --xf-gain-green”).

---

## 4. Summary

- **Must fix for rule compliance:** Remove "aTx" from the logo mark and from aria-labels; use ⚡ + "xF" (or "xF" only) and "xFinance" in copy/a11y.
- **When (re)shipping the new hero:** Add rule subline (“Options Profits Powered by Grok”), tagline typography (uppercase, tracking), $2/hr tooltip, and real links for CTAs.
- **Optional:** Align accent green (rule #22c55e vs design-system #39ff14) and document in the rule or brand kit.
