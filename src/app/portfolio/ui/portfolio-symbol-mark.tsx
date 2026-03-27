"use client";

import { useState } from "react";

type PortfolioSymbolMarkProps = {
  symbol: string;
  logoUrl?: string;
  title?: string;
  size?: number;
};

export function PortfolioSymbolMark({ symbol, logoUrl, title, size = 28 }: PortfolioSymbolMarkProps) {
  const [broken, setBroken] = useState(false);
  const sym = symbol.trim().toUpperCase();
  const initials = sym.length >= 2 ? sym.slice(0, 2) : sym || "—";

  return (
    <span className="portfolio-symbol-mark" title={title ?? sym} style={{ width: size, height: size }}>
      {!broken && logoUrl ? (
        // eslint-disable-next-line @next/next/no-img-element -- remote logo URLs from Yahoo / ticker CDN
        <img
          alt=""
          className="portfolio-symbol-mark__img"
          height={size}
          src={logoUrl}
          width={size}
          onError={() => setBroken(true)}
        />
      ) : (
        <span className="portfolio-symbol-mark__fallback">{initials}</span>
      )}
    </span>
  );
}
