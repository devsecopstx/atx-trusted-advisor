/**
 * Caps point count for Apex / canvas charts — keeps endpoints and evenly spaced samples.
 */
export function downsampleTimeSeries<T>(items: readonly T[], maxPoints: number): T[] {
  if (maxPoints < 2 || items.length <= maxPoints) {
    return [...items];
  }
  const n = items.length;
  const stride = Math.ceil(n / maxPoints);
  const out: T[] = [];
  for (let i = 0; i < n; i += stride) {
    out.push(items[i]!);
  }
  const last = items[n - 1]!;
  if (out[out.length - 1] !== last) {
    out.push(last);
  }
  return out;
}
