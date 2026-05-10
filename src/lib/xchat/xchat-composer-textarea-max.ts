/**
 * Upper bound for autosizing the xChat composer textarea (must stay in sync with
 * `.xchat-composer__textarea` / `--grok` max-height in `xchat.css`).
 */
const XCHAT_COMPOSER_TEXTAREA_ABS_MAX_PX = 560;

/** Viewport-aware cap so long pastes scroll inside the textarea instead of crushing chrome. */
export function getXchatComposerTextareaMaxPx(): number {
  if (typeof window === "undefined") {
    return XCHAT_COMPOSER_TEXTAREA_ABS_MAX_PX;
  }
  return Math.min(XCHAT_COMPOSER_TEXTAREA_ABS_MAX_PX, Math.floor(window.innerHeight * 0.52));
}
