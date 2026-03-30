/**
 * Wilder RSI from closing prices (period default 14).
 * Returns null if insufficient data.
 */
export function computeRsiFromCloses(closes: number[], period = 14): number | null {
  if (closes.length < period + 1) {
    return null;
  }
  const slice = closes.slice(-(period + 1));
  let gain = 0;
  let loss = 0;
  for (let i = 1; i < slice.length; i++) {
    const ch = slice[i]! - slice[i - 1]!;
    if (ch >= 0) {
      gain += ch;
    } else {
      loss -= ch;
    }
  }
  const avgGain = gain / period;
  const avgLoss = loss / period;
  if (avgLoss === 0) {
    return avgGain > 0 ? 100 : 50;
  }
  const rs = avgGain / avgLoss;
  return Math.round((100 - 100 / (1 + rs)) * 10) / 10;
}
