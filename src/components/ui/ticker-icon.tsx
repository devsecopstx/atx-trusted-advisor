"use client";

import Image from "next/image";
import { useMemo, useState } from "react";

export type TickerIconProps = {
  symbol: string;
  /** Optional full company name for tooltip */
  companyName?: string | null;
  /** 24 by default */
  size?: number;
  /** Optional CSS class on the outer wrapper */
  className?: string;
};

// Very lightweight color hash for fallback background
function hashHue(input: string): number {
  let h = 0;
  for (let i = 0; i < input.length; i++) h = (h * 31 + input.charCodeAt(i)) >>> 0;
  return h % 360;
}

const DISABLE_REMOTE = String(process.env.NEXT_PUBLIC_DISABLE_REMOTE_LOGOS || "").toLowerCase() === "1";

/**
 * Small ticker icon: 24×24 rounded with subtle border using --xf-gain-green/20.
 * Provider order: FMP → Google S2 → monogram (no network).
 */
export function TickerIcon({ symbol, companyName, size = 24, className = "" }: TickerIconProps) {
  const initials = (symbol || "?").slice(0, 2).toUpperCase();
  const title = companyName ? `${symbol.toUpperCase()} — ${companyName}` : symbol.toUpperCase();

  const hue = hashHue(symbol || "");
  const bg = `hsl(${hue} 30% 16% / 1)`; // deep-dark tint per symbol
  const borderColor = "color-mix(in srgb, var(--xf-gain-green) 20%, transparent)";

  // Build candidate providers in order of preference.
  const candidates = useMemo(() => {
    if (DISABLE_REMOTE) return [] as string[];
    const s = symbol?.toUpperCase().trim();
    if (!s) return [];
    const sz = Math.max(16, Math.min(64, size));
    // Primary: Financial Modeling Prep logo CDN (no key, strong US coverage)
    const fmp = `https://images.financialmodelingprep.com/symbol/${encodeURIComponent(s)}.png`;
    // Secondary: company domain favicons via Google S2
    const domainBy: Record<string, string> = {
      AAPL: "apple.com",
      MSFT: "microsoft.com",
      GOOGL: "abc.xyz",
      GOOG: "abc.xyz",
      AMZN: "amazon.com",
      META: "meta.com",
      NVDA: "nvidia.com",
      TSLA: "tesla.com",
      JPM: "jpmorganchase.com",
      BAC: "bankofamerica.com",
      XOM: "exxon.com",
      BRK: "berkshirehathaway.com",
      V: "visa.com",
      MA: "mastercard.com"
    };
    const host = domainBy[s];
    const more = host ? [`https://www.google.com/s2/favicons?domain=${host}&sz=${sz}`] : [];
    return [fmp, ...more];
  }, [symbol, size]);

  const [index, setIndex] = useState(0);
  const [failedAll, setFailedAll] = useState(false);
  const src = candidates[index];

  function handleError() {
    if (index < candidates.length - 1) {
      setIndex(index + 1);
    } else {
      setFailedAll(true);
    }
  }

  const showMonogram = failedAll || !src;

  return (
    <span
      className={["inline-flex items-center justify-center rounded-md", "border", className].join(" ")}
      style={{
        width: size,
        height: size,
        borderColor,
        overflow: "hidden",
        background: bg
      }}
      title={title}
      aria-label={title}
    >
      {!showMonogram ? (
        <Image
          alt={title}
          src={src}
          width={size}
          height={size}
          unoptimized
          style={{ objectFit: "cover" }}
          onError={handleError}
        />
      ) : (
        <span className="font-mono text-[0.6rem] font-bold leading-none text-[var(--xf-text-200)]" aria-hidden>
          {initials}
        </span>
      )}
    </span>
  );
}
