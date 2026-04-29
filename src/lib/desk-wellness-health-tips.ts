/**
 * Short desk wellness reminders — general education only; not medical advice.
 * Rotated deterministically per calendar day (see `pickHealthTipForLocalDate`).
 */
export const DESK_HEALTH_TIPS: readonly string[] = [
  "Step away from the desk every hour — eyes, posture, clarity.",
  "Hydrate before the afternoon slump; caffeine isn’t a substitute for water.",
  "Five minutes of quiet breathing can reset stress between volatile prints.",
  "Protect sleep: screens down 30–60 minutes before bed when you can.",
  "Pair protein with carbs at lunch to avoid the post-meeting crash.",
  "Natural light before noon helps circadian rhythm — step outside if possible.",
  "Stand or pace on long calls; circulation beats stiff hips.",
  "Stretch neck and shoulders between ticker checks.",
  "Keep rescue meds only per your clinician — no desk substitutions.",
  "Batch notifications so deep-work blocks stay intact.",
  "Walk after lunch — even ten minutes aids glucose and focus.",
  "Limit doom-scroll after hours; markets reopen tomorrow.",
  "Ergonomic tweak: monitor top near eye level, elbows ~90°.",
  "Blue-light filters help some people after sunset.",
  "Social connection counts as health capital — one real conversation today.",
  "Gratitude jot (one line) can steady mindset before volatile opens."
];

/** Stable tip for the given local calendar day (same device day = same tip). */
export function pickHealthTipForLocalDate(d: Date): string {
  const y = d.getFullYear();
  const jan1 = new Date(y, 0, 1);
  const diffMs = new Date(y, d.getMonth(), d.getDate()).getTime() - jan1.getTime();
  const dayOfYear = Math.round(diffMs / 86400000);
  const idx = Math.abs(dayOfYear) % DESK_HEALTH_TIPS.length;
  return DESK_HEALTH_TIPS[idx] ?? DESK_HEALTH_TIPS[0]!;
}
