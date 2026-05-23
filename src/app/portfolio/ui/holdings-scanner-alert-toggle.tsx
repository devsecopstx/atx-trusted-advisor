"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { ActivityPulseIcon } from "@/app/admin/ui/crud-icons";
import { watchlistQueryKeys } from "@/lib/react-query/query-keys";
import { DEFAULT_MIN_ABS_MOVE_PERCENT } from "@/modules/watchlist/price-alert-constants";

type WatchlistSymbolRow = {
  symbol: string;
  priceAlertMinAbsMovePercent?: number;
};

type WatchlistPayload = {
  data?: {
    symbols?: WatchlistSymbolRow[];
    symbolsDetailed?: WatchlistSymbolRow[];
  };
};

async function fetchWatchlistSymbols(portfolioIdHex: string): Promise<WatchlistSymbolRow[]> {
  const res = await fetch(`/api/portfolios/${encodeURIComponent(portfolioIdHex)}/watchlist`, {
    credentials: "include"
  });
  const payload = (await res.json().catch(() => ({}))) as WatchlistPayload & { error?: string };
  if (!res.ok) {
    throw new Error(payload.error ?? "Could not load watchlist");
  }
  return payload.data?.symbolsDetailed ?? payload.data?.symbols ?? [];
}

type HoldingsScannerAlertToggleProps = {
  portfolioIdHex: string;
  symbol: string;
  disabled?: boolean;
};

export function HoldingsScannerAlertToggle({
  portfolioIdHex,
  symbol,
  disabled = false
}: HoldingsScannerAlertToggleProps) {
  const qc = useQueryClient();
  const sym = symbol.trim().toUpperCase();

  const watchlistQuery = useQuery({
    queryKey: watchlistQueryKeys.detail(portfolioIdHex, "scanner-alerts"),
    queryFn: () => fetchWatchlistSymbols(portfolioIdHex),
    enabled: Boolean(portfolioIdHex && sym),
    staleTime: 60_000
  });

  const thresholdPct = (watchlistQuery.data ?? []).find(
    (row) => row.symbol.trim().toUpperCase() === sym
  )?.priceAlertMinAbsMovePercent;
  const enabled = thresholdPct != null && Number.isFinite(thresholdPct);

  const toggleMutation = useMutation({
    mutationFn: async (nextEnabled: boolean) => {
      const res = await fetch(`/api/portfolios/${encodeURIComponent(portfolioIdHex)}/watchlist`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          addEntries: [
            {
              symbol: sym,
              priceAlertMinAbsMovePercent: nextEnabled ? DEFAULT_MIN_ABS_MOVE_PERCENT : null
            }
          ]
        })
      });
      const payload = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        throw new Error(payload.error ?? "Could not update scanner alert");
      }
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: watchlistQueryKeys.portfolio(portfolioIdHex) });
      void qc.invalidateQueries({ queryKey: watchlistQueryKeys.detail(portfolioIdHex, "scanner-alerts") });
    }
  });

  const busy = toggleMutation.isPending || watchlistQuery.isFetching;

  return (
    <button
      type="button"
      className={`portfolio-consolidated-holdings__scanner-alert-btn${enabled ? " portfolio-consolidated-holdings__scanner-alert-btn--on" : ""}`}
      aria-pressed={enabled}
      aria-label={
        enabled
          ? `Scanner alerts on for ${sym} (${thresholdPct}% move threshold). Click to disable.`
          : `Enable price scanner alerts for ${sym}`
      }
      title={
        enabled
          ? `Scanner on · ${thresholdPct}% move`
          : "Enable price scanner alerts (watchlist threshold)"
      }
      disabled={disabled || busy}
      onClick={() => toggleMutation.mutate(!enabled)}
    >
      <ActivityPulseIcon className="crud-icon" aria-hidden />
      <span className="portfolio-consolidated-holdings__scanner-alert-btn__label" aria-hidden>
        {enabled ? "Scan on" : "Scan"}
      </span>
    </button>
  );
}
