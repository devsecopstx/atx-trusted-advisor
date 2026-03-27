"use client";

import { useEffect, useRef, useState } from "react";

import type { SymbolLookupResult } from "@/modules/watchlist/yahoo-symbol-lookup";

export type SymbolQuotePayload = {
  symbol: string;
  quote: SymbolLookupResult | null;
  fromWatchlist: boolean;
  watchlistEntry: {
    entryPrice: number | null;
    quantity: number | null;
    lineType: string | null;
  } | null;
  suggestedPurchasePrice: number | null;
};

type PortfolioStockQuoteHintProps = {
  portfolioId: string;
  symbolRaw: string;
  active: boolean;
  /** Called when a suggested price is available and the purchase field is still empty (once per resolved symbol). */
  onAutoFillPurchasePrice?: (price: number) => void;
};

export function PortfolioStockQuoteHint({
  portfolioId,
  symbolRaw,
  active,
  onAutoFillPurchasePrice
}: PortfolioStockQuoteHintProps) {
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [data, setData] = useState<SymbolQuotePayload | null>(null);
  const fillCbRef = useRef(onAutoFillPurchasePrice);
  fillCbRef.current = onAutoFillPurchasePrice;

  useEffect(() => {
    if (!active) {
      setData(null);
      setErr(null);
      setLoading(false);
      return;
    }
    const sym = symbolRaw.trim().toUpperCase();
    if (sym.length < 1) {
      setData(null);
      setErr(null);
      return;
    }
    let cancelled = false;
    const t = window.setTimeout(() => {
      void (async () => {
        setLoading(true);
        setErr(null);
        try {
          const res = await fetch(
            `/api/portfolios/${encodeURIComponent(portfolioId)}/symbol-quote?symbol=${encodeURIComponent(sym)}`,
            { cache: "no-store" }
          );
          const body = (await res.json().catch(() => ({}))) as {
            data?: SymbolQuotePayload;
            error?: string;
          };
          if (cancelled) return;
          if (!res.ok) {
            setData(null);
            setErr(body.error ?? "Quote unavailable");
            return;
          }
          if (body.data) {
            setData(body.data);
            const p = body.data.suggestedPurchasePrice;
            if (p != null && Number.isFinite(p)) {
              fillCbRef.current?.(p);
            }
          }
        } catch {
          if (!cancelled) {
            setErr("Network error");
            setData(null);
          }
        } finally {
          if (!cancelled) setLoading(false);
        }
      })();
    }, 420);

    return () => {
      cancelled = true;
      window.clearTimeout(t);
    };
  }, [active, portfolioId, symbolRaw]);

  if (!active) {
    return null;
  }
  const sym = symbolRaw.trim().toUpperCase();
  if (sym.length < 1) {
    return null;
  }

  if (loading && !data) {
    return (
      <p className="portfolio-stock-quote-hint portfolio-stock-quote-hint--muted" role="status">
        Loading quote…
      </p>
    );
  }
  if (err && !data) {
    return (
      <p className="portfolio-stock-quote-hint portfolio-stock-quote-hint--warn" role="status">
        {err}
      </p>
    );
  }
  if (!data) {
    return null;
  }

  const q = data.quote;
  const price =
    q?.price != null && Number.isFinite(q.price)
      ? q.price
      : data.suggestedPurchasePrice != null
        ? data.suggestedPurchasePrice
        : null;
  const src = data.fromWatchlist ? "Watchlist + live" : "Live quote";

  return (
    <div className="portfolio-stock-quote-hint" role="status">
      {q?.logoUrl ? (
        <span className="portfolio-stock-quote-hint__logo">
          {/* eslint-disable-next-line @next/next/no-img-element -- remote ticker logos; avoid image domain allowlist */}
          <img
            src={q.logoUrl}
            alt=""
            width={28}
            height={28}
            className="portfolio-stock-quote-hint__logo-img"
            loading="lazy"
            referrerPolicy="no-referrer"
          />
        </span>
      ) : (
        <span className="portfolio-stock-quote-hint__logo portfolio-stock-quote-hint__logo--placeholder" aria-hidden>
          {data.symbol.slice(0, 1)}
        </span>
      )}
      <div className="portfolio-stock-quote-hint__meta">
        <span className="portfolio-stock-quote-hint__name">
          {q?.companyName ?? data.symbol}
        </span>
        {price != null ? (
          <span className="portfolio-stock-quote-hint__price">
            {price.toLocaleString("en-US", { style: "currency", currency: q?.currency ?? "USD" })}
          </span>
        ) : (
          <span className="portfolio-stock-quote-hint__price portfolio-stock-quote-hint__price--na">No price</span>
        )}
        <span className="portfolio-stock-quote-hint__src">{src}</span>
      </div>
    </div>
  );
}
