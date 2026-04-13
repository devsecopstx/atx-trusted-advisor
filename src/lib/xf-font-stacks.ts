/**
 * JS / print-template fallbacks when CSS variables are unavailable.
 * Keep in sync with `atx-docs/design-system/atxfinance-brand-kit.css` (`--xf-font-mono`, `--xf-font-sans`).
 */
export const XF_FONT_MONO_FALLBACK =
  'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace';

/** Standalone documents (e.g. print) cannot read app `:root` tokens — mirrors sans stack after `next/font` Inter. */
export const XF_FONT_SANS_FALLBACK = 'Inter, "Segoe UI", system-ui, sans-serif';
