/**
 * Shared OptionsStrategyEngine desk constants (Next.js scanner + JVM parity).
 * @see atx-docs/design-system/xoptions/strategy-engine.md
 */

/** Long straddle / strangle leg selection — absolute delta band (May 2026 desk refresh). */
export const STRADDLE_DELTA_RANGE = {
  min: 0.15,
  max: 0.3
} as const;

export const STRADDLE_DELTA_TARGET = 0.225;

export function straddleDeltaInRange(deltaAbs: number): boolean {
  return deltaAbs >= STRADDLE_DELTA_RANGE.min && deltaAbs <= STRADDLE_DELTA_RANGE.max;
}

export function straddleDeltaDistanceScore(deltaAbs: number): number {
  if (!straddleDeltaInRange(deltaAbs)) {
    return Number.POSITIVE_INFINITY;
  }
  return Math.abs(deltaAbs - STRADDLE_DELTA_TARGET);
}
