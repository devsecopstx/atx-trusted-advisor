/**
 * Broker / custodian account external ref (extAccountId) — user-facing display only.
 * Full value is treated as secret; only the last four characters are shown when length > 4.
 */
export function maskAccountXrefForDisplay(raw: string | null | undefined): string {
  const s = (raw ?? "").trim();
  if (!s) {
    return "—";
  }
  if (s.length <= 4) {
    return "••••";
  }
  return `••••${s.slice(-4)}`;
}
