/** Phased status copy while `/api/xchat/ask` is in flight (`askProgressPhaseIndex` 0–3). */
export const XCHAT_ASK_PROGRESS_BADGES = [
  "Gathering portfolio & account snapshot…",
  "Fetching live Yahoo quotes & OI/IV…",
  "Consulting options-strategy RAG + X sentiment…",
  "Synthesizing conservative / balanced / aggressive outlooks…"
] as const;
