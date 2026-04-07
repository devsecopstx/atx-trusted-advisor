export function maskIbkrToken(id: string): string {
  const t = id.trim();
  if (t.length <= 8) {
    return t;
  }
  return `${t.slice(0, 4)}…${t.slice(-2)}`;
}
