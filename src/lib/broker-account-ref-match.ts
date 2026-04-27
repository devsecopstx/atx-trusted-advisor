/**
 * Match broker CSV export account ref to portfolio `extAccountId`.
 * Exports may include only the last four digits; the book often stores the full number.
 */
export function brokerExportRefMatchesStoredExt(brokerRef: string, storedExt: string): boolean {
  const a = brokerRef.trim();
  const b = storedExt.trim();
  if (!a || !b) {
    return false;
  }
  if (a === b) {
    return true;
  }
  const al = a.toLowerCase();
  const bl = b.toLowerCase();
  if (al === bl) {
    return true;
  }

  /**
   * Formatting-tolerant compare for mixed refs (slashes, spaces, tabs, punctuation).
   * Example: `1 / 2 / 1` vs `1/2/1` should match before digit-only fallback.
   */
  const an = al.replace(/[^a-z0-9]/g, "");
  const bn = bl.replace(/[^a-z0-9]/g, "");
  if (an && bn && an === bn) {
    return true;
  }

  const da = a.replace(/\D/g, "");
  const db = b.replace(/\D/g, "");
  if (da && db && da === db) {
    return true;
  }
  // Last 4 in file vs full account # in portfolio (digits only).
  if (da.length === 4 && db.length > 4 && db.endsWith(da)) {
    return true;
  }

  return false;
}
