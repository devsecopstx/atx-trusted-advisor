/**
 * Options scanner stores `[afp:…]` with optional `|acct:…` suffix for per-account dedupe.
 * UI shows the contract key without `afp` or the internal account id (book · account column covers that).
 */
function stripInternalAcctSuffixFromContractKey(inner: string): string {
  return inner.replace(/\|acct:[a-f0-9]{24}$/i, "").trim();
}

export function formatPortfolioAlertBodyForDisplay(body: string | undefined): string {
  if (!body?.trim()) {
    return "";
  }
  return body
    .split(/\r?\n/)
    .map((line) => {
      const t = line.trim();
      const m = t.match(/^\[afp:(.+)\]$/);
      if (m) {
        return stripInternalAcctSuffixFromContractKey(m[1]);
      }
      return line;
    })
    .join("\n");
}
