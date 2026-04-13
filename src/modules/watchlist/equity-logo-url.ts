import { parseOccOptionSymbol } from "@/modules/watchlist/option-expiration";

/**
 * Public square logos keyed by Yahoo-style root (incl. `BRK.B`). IEX’s GCS bucket often returns **403** for many
 * tickers in-browser, so we use Fool CDN for reliable `<img src>` loads on portfolio / watchlist.
 */
const FOOL_EQUITY_LOGO_BASE = "https://g.foolcdn.com/art/companylogos/square";

/**
 * Normalized equity root for logo CDN keys (underlying for OCC options).
 * Returns undefined when the symbol is not a plausible equity key.
 */
export function equityLogoKeyRoot(rawSymbol: string): string | undefined {
  const s = rawSymbol.trim().toUpperCase();
  if (!s) {
    return undefined;
  }
  const occ = parseOccOptionSymbol(s);
  const root = occ?.underlying ?? s;
  if (!/^[A-Z0-9][A-Z0-9.\-]{0,14}$/.test(root)) {
    return undefined;
  }
  return root;
}

/**
 * Yahoo `quote()` batch path does not return logo URLs. Use Fool CDN PNGs keyed by equity root.
 */
export function defaultWatchlistLogoUrl(rawSymbol: string): string | undefined {
  const root = equityLogoKeyRoot(rawSymbol);
  if (!root) {
    return undefined;
  }
  return `${FOOL_EQUITY_LOGO_BASE}/${encodeURIComponent(root)}.png`;
}
