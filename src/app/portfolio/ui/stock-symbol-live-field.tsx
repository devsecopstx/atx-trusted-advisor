"use client";

import { useEffect, useMemo, useState } from "react";

import type { SymbolLookupResult } from "@/modules/watchlist/yahoo-symbol-lookup";

import { PortfolioSymbolMark } from "@/app/portfolio/ui/portfolio-symbol-mark";

type StockSymbolLiveFieldProps = {
  symbolInput: string;
  purchasePrice: string;
  onSuggestPurchasePrice: (price: string) => void;
};

export function StockSymbolLiveField({
  symbolInput,
  purchasePrice,
  onSuggestPurchasePrice
}: StockSymbolLiveFieldProps) {
  const sym = useMemo(() => symbolInput.trim().toUpperCase(), [symbolInput]);
  const symValid = sym.length >= 1 && sym.length <= 12;
  const [quote, setQuote] = useState<SymbolLookupResult | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!symValid) {
      return;
    }
    const t = window.setTimeout(() => {
      setLoading(true);
      fetch(`/api/market/symbol-quotes?symbols=${encodeURIComponent(sym)}`, { credentials: "include" })
        .then((r) => r.json() as Promise<{ data?: Record<string, SymbolLookupResult | null> }>)
        .then((payload) => setQuote(payload.data?.[sym] ?? null))
        .catch(() => setQuote(null))
        .finally(() => setLoading(false));
    }, 450);
    return () => window.clearTimeout(t);
  }, [sym, symValid]);

  const activeQuote = symValid ? quote : null;

  const priceStr =
    activeQuote?.price !== undefined && Number.isFinite(activeQuote.price)
      ? activeQuote.price.toLocaleString("en-US", { style: "currency", currency: activeQuote.currency ?? "USD" })
      : null;

  const canFill = Boolean(symValid && priceStr && purchasePrice.trim() === "");

  return (
    <div className="portfolio-stock-live-hint">
      {symValid && (activeQuote || loading) ? (
        <div className="portfolio-stock-live-hint__row">
          <PortfolioSymbolMark
            logoUrl={activeQuote?.logoUrl}
            size={26}
            symbol={sym || "?"}
            title={activeQuote?.companyName}
          />
          <div className="portfolio-stock-live-hint__meta">
            {loading ? (
              <span className="portfolio-stock-live-hint__muted">Loading quote…</span>
            ) : priceStr ? (
              <>
                <span className="portfolio-stock-live-hint__price">Last {priceStr}</span>
                {activeQuote?.changePercent !== undefined && Number.isFinite(activeQuote.changePercent) ? (
                  <span
                    className={`portfolio-stock-live-hint__chg${activeQuote.changePercent >= 0 ? " portfolio-stock-live-hint__chg--up" : ""}`}
                  >
                    {activeQuote.changePercent >= 0 ? "+" : ""}
                    {activeQuote.changePercent.toFixed(2)}%
                  </span>
                ) : null}
              </>
            ) : (
              <span className="portfolio-stock-live-hint__muted">No live quote</span>
            )}
          </div>
        </div>
      ) : null}
      {canFill ? (
        <button
          className="portfolio-stock-live-hint__fill"
          type="button"
          onClick={() => {
            if (activeQuote?.price !== undefined && Number.isFinite(activeQuote.price)) {
              onSuggestPurchasePrice(String(activeQuote.price));
            }
          }}
        >
          Use last for purchase price
        </button>
      ) : null}
    </div>
  );
}
