export type WatchlistPatchMetadata = {
  symbolLookupEnabled?: boolean;
};

/** PATCH via Spring BFF returns rows without Yahoo quotes; Next GET must refetch. */
export function watchlistPatchShouldRefetchQuotes(
  metadata: WatchlistPatchMetadata | undefined,
  body: Record<string, unknown>
): boolean {
  if (metadata?.symbolLookupEnabled === false) {
    return true;
  }
  if (body.dedupe === true) {
    return true;
  }
  const removeSymbols = body.removeSymbols;
  if (Array.isArray(removeSymbols) && removeSymbols.length > 0) {
    return true;
  }
  const addSymbols = body.addSymbols;
  if (Array.isArray(addSymbols) && addSymbols.length > 0) {
    return true;
  }
  return false;
}
