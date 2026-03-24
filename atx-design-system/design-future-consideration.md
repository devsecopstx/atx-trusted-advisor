PLAN todos to consider in future roadmap. for high frequency or RIA with license.

## UX polish (motion)

- **Wheel strategy visual** — Add subtle, accessible motion to the wheel / income-cycle story on marketing and in-product surfaces (e.g. pitch hero motif, optional branded flow diagram). Respect `prefers-reduced-motion`; keep loops slow and non-distracting.
- **Onboarding workflows** — Stagger or transition steps in admin xPersona onboarding and related core-admin flows (directory load, filter changes, empty states) so progress feels guided without hurting scan speed for operators.

When native multi-agent would still be useful (optional Phase 2+)
Only consider switching to grok-4.20-multi-agent for these narrow cases:

Very open-ended synthesis after inputs are complete (e.g. “brainstorm 5 wildly different strategies given the same inputs”)
Creative ideation phase before structured collection
When you want Grok to invent new question types dynamically (risky)

But for your core xStrategyBuilder loop (collect → validate → synthesize → recommend), your server-driven approach is superior — more reliable, cheaper, safer, and easier to audit.
