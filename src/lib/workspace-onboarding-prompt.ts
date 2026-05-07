/** Single-screen onboarding → xChat composer handoff (sessionStorage via {@link XCHAT_PENDING_PROMPT_STORAGE_KEY}). */

export function buildWorkspaceOnboardingCoveredCallPrompt(topEquitySymbol: string | null): string {
  const sym = topEquitySymbol?.trim().toUpperCase();
  if (sym && /^[A-Z][A-Z0-9.-]{0,14}$/.test(sym)) {
    return [
      `Using my ${sym} stock position in my workspace book, suggest a conservative covered-call outline for the nearest weekly expiry:`,
      "OTM strike rationale vs premium, approximate delta range you'd consider conservative, and what I'd do if price gaps through the short strike.",
      "Educational framing only — not financial advice."
    ].join(" ");
  }
  return [
    "Using my largest stock holding in my workspace book, suggest a conservative covered-call outline for the nearest weekly expiry:",
    "OTM strike rationale vs premium, a conservative delta band, and roll or exit cues if price moves sharply against the short call.",
    "Educational framing only — not financial advice."
  ].join(" ");
}
