# Outline Style v2

## Full-Bleed Starfield Background (Workspace Addendum)

- Mount a single `<StarfieldBackground />` layer per workspace shell (`/xchat`, `/xoptions`, `/portfolios`) so the backdrop spans full viewport width/height behind sidebar, header, and footer.
- Layer contract: fixed `inset: 0`, `z-index: -20`, pointer-events disabled, with foreground product chrome at positive z-index.
- Theme parity:
  - Soft/light: base `#FAFBFC`, node `#94A3B8`, line `#CBD5E1`, skyline opacity `0.12`.
  - Deep/dark: base `#0B0F14`, node `#64748B`, line `#475569`, skyline opacity `0.08`.
- Visual stack order: base fill -> subtle center radial -> 1px grid -> low-density constellation nodes/links -> static skyline anchored at bottom 35% viewport.
- Motion contract (CSS-only, reduced-motion aware):
  - Nodes breathe (`star-twinkle`) over 9-11 seconds, staggered.
  - Connection lines pulse (`star-connect`) over 14 seconds.
  - Grid drifts slowly (`star-grid-drift`) over 14 seconds.
  - `prefers-reduced-motion: reduce` disables all starfield animation.
- Component does not react to panel focus/selection state. The ambient layer remains global and constant to preserve quiet-confidence framing.
