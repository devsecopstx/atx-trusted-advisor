# `/ai-rent` — partner marketing page (spec)

**Status:** Spec only — no route shipped until implemented.  
**Audience:** RIAs, family offices, fintech partners evaluating **white-label rental API** access (not retail “sign up free”).

**Brand source:** [`.cursor/rules/xfinance-branding.mdc`](../../.cursor/rules/xfinance-branding.mdc) and [`atxfinance-brand-kit.css`](./atxfinance-brand-kit.css).

---

## Positioning

- **Narrative:** Lead with **outcomes** — isolated, Grok-powered options-aware advisory **for their end-clients**, delivered via **HTTPS API** they control (`POST /api/ai/rent/*`). Then stack: tenant isolation, **risk posture** (conservative default), portfolio-aware chat, strategy/analyze job pattern.
- **Tagline (hero):** **No Atoms Moved. Just Gains Earned.**
- **Subline:** **Options Profits Powered by Grok** (secondary line may mention **approved partner access** / **API integration** — not mass-market scale).
- **Wordmark:** **aTx⚡Finance** — lightning bolt between **aTx** and **Finance**; use `AtxFinanceMark` / tokens from `src/app/ui/atxfinance-logo.tsx` when implementing.

Differentiation (use one short paragraph): execution-style portfolio context + **Grok** advisory in **their** branded tenant boundary — distinct from generic chat-only widgets.

---

## Honest constraints (copy rules)

- **Do not** claim live customer counts, logos, or testimonials **unless** productized and true.
- **Do not** show dollar list prices on this page until **`/account/billing` (or `/plans`)** ships a rental SKU for self-serve partners. Prefer **“Request access”** / **“Talk to us”** primary CTA; optional secondary: **“View API docs”** → OpenAPI / `MCP-AI-ADVISOR.md` (or authenticated docs if gated).
- **Illustrative investor/deck figures** (~$99/mo framing, per-token metering) belong in **PDF/deck footnotes** or internal ops docs — not as fake checkout on this page (see branding rule on customer UI vs deck).
- Frame distribution as **controlled access** / **approved professionals** where appropriate.

---

## Visual & layout

- **Theme:** Dark only. Background and text via **`--xf-*`** tokens (e.g. `--xf-bg-900`, `--xf-gain-green`, `--xf-lightning-yellow` for bolt/hover accents). No hardcoded hex in CSS.
- **Hero:** Full-width dark panel; headline + subline; single primary CTA; optional lightning + **xF** icon treatment for large marketing marks when full lockup is heavy.
- **Type:** Bold tight headline (`font-bold tracking-tighter`, responsive `text-5xl md:text-7xl` class pattern); body legible slate/gray token text; optional `font-mono text-sm` for endpoint bullets.
- **Sections (suggested order):**
  1. **Hero** — outcome + CTA  
  2. **What you get** — 3–4 bullets: tenant isolation, `Bearer atxr_*` keys + scopes, chat JSON/SSE, strategy/analyze poll pattern, UTC-day token budget, audit (`rental_ai`)  
  3. **Who it’s for** — RIA / family office / licensed desk (compliance-forward, not legal advice)  
  4. **Technical trust** — link to OpenAPI **`rental-ai`** tag, [`llm.txt`](../../llm.txt), [`MCP-AI-ADVISOR.md`](../MCP-AI-ADVISOR.md)  
  5. **Compliance** — “Not financial advice”; outputs depend on tenant configuration; no broker execution via API  
  6. **Footer** — slim; match marketing footer links used elsewhere

---

## CTA matrix

| CTA | Destination (suggestion) |
|-----|---------------------------|
| Primary | `mailto:` or `/contact` or hubspot form — **not** a fake Stripe checkout |
| Secondary | External doc link or `GET /api/openapi` description for engineers (or gated admin doc) |
| Tertiary | `tenant-specs/README.md` for operators **or** “Schedule technical call” |

---

## Implementation checklist (dev)

- [ ] `src/app/ai-rent/page.tsx` (or `marketing/ai-rent`) — Server Component first; minimal client JS.
- [ ] Import shared marketing layout if one exists; else mirror a simple marketing shell (header with lockup).
- [ ] `layout.tsx` — metadata `title` / `description` mentioning **xFinance** rental API; **no** misleading pricing schema.org.
- [ ] Optional: `noindex` until GTM ready (`robots` / metadata).
- [ ] `proxy.ts` / middleware: **public** route unless product wants auth — default **public** for lead capture.
- [ ] Cross-link from internal PLAN or ops doc when page goes live.

---

## Related

- [`sre-ops/rental-ai-platform.md`](../sre-ops/rental-ai-platform.md)  
- [`guides/rental-ai-system-prompt.md`](../guides/rental-ai-system-prompt.md)  
- Product backlog: [`PLAN.md`](../PLAN.md) (AI Rental follow-ons)
