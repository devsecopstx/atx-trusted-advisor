export type PortfolioDeskPrefetchStrip = {
  watchlistSymbolCount: number;
  /** Same symbols as the embedded watchlist / user-global desk doc (not the IV/OI hot scan). */
  watchlistPreviewSymbols?: string[];
  activeAlertsCount: number;
  ibkrLinkedAccountCount: number | null;
};
