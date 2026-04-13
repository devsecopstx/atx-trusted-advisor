"use client";

import { useState } from "react";

import { defaultWatchlistLogoUrl, equityLogoKeyRoot } from "@/modules/watchlist/equity-logo-url";

type PortfolioSymbolMarkProps = {
  symbol: string;
  logoUrl?: string;
  title?: string;
  size?: number;
};

export function PortfolioSymbolMark({ symbol, logoUrl, title, size = 28 }: PortfolioSymbolMarkProps) {
  const [broken, setBroken] = useState(false);
  const sym = symbol.trim().toUpperCase();
  const root = equityLogoKeyRoot(sym) ?? sym;
  const initials = root.length >= 2 ? root.slice(0, 2) : root || "—";
  const fromApi = (logoUrl ?? "").trim();
  const fromCdn = defaultWatchlistLogoUrl(sym) ?? "";
  const imgSrc = !broken && (fromApi || fromCdn) ? fromApi || fromCdn : "";

  return (
    <span className="portfolio-symbol-mark" title={title ?? sym} style={{ width: size, height: size }}>
      {imgSrc ? (
        // eslint-disable-next-line @next/next/no-img-element -- remote equity logos (Fool CDN / API)
        <img
          alt=""
          className="portfolio-symbol-mark__img"
          decoding="async"
          height={size}
          loading="lazy"
          referrerPolicy="no-referrer"
          src={imgSrc}
          width={size}
          onError={() => setBroken(true)}
        />
      ) : (
        <span className="portfolio-symbol-mark__fallback">{initials}</span>
      )}
    </span>
  );
}
