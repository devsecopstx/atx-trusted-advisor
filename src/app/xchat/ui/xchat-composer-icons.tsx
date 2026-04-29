/** Shared SVG icons for xChat composer chrome (approved + guest shells). */

/**
 * Stroke-outline glyphs (Lucide-style 24×24, stroke 2) — read better than thin filled paths
 * when scaled on dark/light shells (aligned with common Grok / chat-composer UI patterns).
 */

export function XchatComposerAttachIcon() {
  return (
    <svg
      aria-hidden
      fill="none"
      height={24}
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      viewBox="0 0 24 24"
      width={24}
    >
      <path d="m21.44 11.05-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48" />
    </svg>
  );
}

export function XchatComposerMicIcon() {
  return (
    <svg
      aria-hidden
      fill="none"
      height={24}
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      viewBox="0 0 24 24"
      width={24}
    >
      <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" />
      <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
      <line x1="12" x2="12" y1="19" y2="22" />
      <line x1="8" x2="16" y1="22" y2="22" />
    </svg>
  );
}

export function XchatComposerWaveformIcon() {
  return (
    <svg aria-hidden fill="currentColor" height={18} viewBox="0 0 24 24" width={18}>
      <rect height="10" rx="1" width="3" x="5" y="7" />
      <rect height="16" rx="1" width="3" x="10.5" y="4" />
      <rect height="8" rx="1" width="3" x="16" y="8" />
    </svg>
  );
}

/** Four-square grid — Grok-style “Sources” affordance. */
export function XchatComposerSourcesGridIcon() {
  return (
    <svg aria-hidden fill="none" height={18} viewBox="0 0 24 24" width={18}>
      <rect height="7.5" rx="1.5" stroke="currentColor" strokeWidth="1.35" width="7.5" x="3.25" y="3.25" />
      <rect height="7.5" rx="1.5" stroke="currentColor" strokeWidth="1.35" width="7.5" x="13.25" y="3.25" />
      <rect height="7.5" rx="1.5" stroke="currentColor" strokeWidth="1.35" width="7.5" x="3.25" y="13.25" />
      <rect height="7.5" rx="1.5" stroke="currentColor" strokeWidth="1.35" width="7.5" x="13.25" y="13.25" />
    </svg>
  );
}

/** Circular send — upward arrow (Grok-style). */
export function XchatComposerArrowUpIcon() {
  return (
    <svg aria-hidden fill="none" height={20} viewBox="0 0 24 24" width={20}>
      <path
        d="M12 17V7m0 0l-4.5 4.5M12 7l4.5 4.5"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
      />
    </svg>
  );
}
