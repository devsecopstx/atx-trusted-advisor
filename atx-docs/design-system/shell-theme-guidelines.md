# Shell theme guidelines — Light (soft) & Dark (deep)

Canonical implementation: `html[data-xf-ui="soft"]` (**Light** / softer charcoal) vs `html:not([data-xf-ui="soft"])` (**Dark** / deep). User preference is stored and resolved in `src/lib/xf-ui-theme.ts` (`applyXfUiToDocument`). Tailwind `dark:` is configured in `tailwind.config.ts` to match the **deep** shell (`html:not([data-xf-ui="soft"])`).

Base tokens: `atx-docs/design-system/atxfinance-brand-kit.css` and `src/app/globals.css` (soft overrides). **Do not hardcode hex** in app CSS for theme surfaces; use `var(--xf-*)` and `color-mix(in srgb, …)`.

---

## Dark theme (“Deep” — black-forward contrast)

- **Backgrounds:** Deep near-black (`--xf-bg-900`, `--xf-bg-800`, `--xf-surface-*`).
- **Text, controls, borders:** Light body (`--xf-text-100`), muted secondary (`--xf-text-200`, `--xf-text-300`), dividers via `color-mix` on `--xf-text-100`.
- **Goal:** Sharp, high-contrast, readable in low light.

---

## Light theme (“Soft” — softer charcoal)

- **Backgrounds:** Soft off-white / light charcoal — **never** harsh pure white as the only canvas; follow `globals.css` soft remaps on `--xf-bg-*` / `--xf-surface-*`.
- **Panels & surfaces:** Gentle mid-tone charcoal (token-mixed surfaces), with **visible** borders (`color-mix` with **higher** `--xf-text-100` weight than on deep, so edges don’t disappear).
- **Text & icons:** Primary = near-black (`--xf-text-100` on soft). Secondary = **`--xf-text-200`** (or a deliberate mix toward `--xf-text-100`), **not** faint gray-on-gray.
- **Goal:** Calm daytime readability, strong contrast, minimal eye fatigue.

---

## Contrast rules (both shells — **blocker** for user-facing UI PRs)

1. **Text must stand out sharply against its local background** (body, cards, tables, sidebars, modals).
2. **No light-gray text on light panels** — avoid `--xf-text-300` / `--xf-text-400` as the main body color on soft surfaces; prefer `--xf-text-100` for primary copy and `--xf-text-200` for secondary.
3. **No dark text lost on dark surfaces** — on deep shell, don’t use near-black or low-contrast mixes on `--xf-surface-*` without checking WCAG-ish contrast.
4. **Borders & dividers** must read in both modes; if a panel looks “floating” in soft, **strengthen** border mix (more `--xf-text-100` in the mix).
5. **Prefer semantic tokens** over `white/10`, `black/20`, raw `rgba`, or fixed hex for backgrounds, text, and borders on product pages.

---

## Reviewer / design gate

- Any PR that touches **user-facing** pages or shared chrome should verify **both** `data-xf-ui="soft"` and **deep** (or use `dark:` utilities where mapped).
- Reference this doc from `.cursor/agents/reviewer.md` and run `.cursor/skills/atxdesign-review/SKILL.md` for combined visual + contract gates.

---

## Related

- `atx-docs/design-system/current-state-features.md` — stack and surface inventory.
- `.cursor/agents/branding.md` — shell appearance, theme picker, token-first UI.
