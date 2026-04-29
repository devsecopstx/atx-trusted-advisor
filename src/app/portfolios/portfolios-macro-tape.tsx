"use client";

import { MacroTapeDeskNav } from "@/app/portfolios/macro-tape-desk-nav";

export type MacroTapeIndex = {
  symbol: string;
  price?: number;
  changePercent?: number;
};

type Props = {
  indices: MacroTapeIndex[];
  visiblePathPrefixes?: string[];
  deskPortfolioId?: string | null;
};

function formatChgPct(p: number | undefined): string {
  if (p === undefined || !Number.isFinite(p)) {
    return "—";
  }
  const sign = p > 0 ? "+" : "";
  return `${sign}${p.toFixed(2)}%`;
}

function formatUsdCompact(n: number): string {
  return n.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: n >= 1000 ? 2 : 2,
    minimumFractionDigits: 2
  });
}

export function PortfoliosMacroTape({ indices, visiblePathPrefixes, deskPortfolioId }: Props) {
  if (indices.length === 0) {
    return null;
  }

  const renderStrip = (suffix: string) =>
    indices.map((ix, i) => {
      const up = (ix.changePercent ?? 0) > 0;
      const down = (ix.changePercent ?? 0) < 0;
      const chgClass = up
        ? "portfolios-macro-tape__chg--up"
        : down
          ? "portfolios-macro-tape__chg--down"
          : "portfolios-macro-tape__chg--flat";
      return (
        <span className="portfolios-macro-tape__item" key={`${suffix}-${ix.symbol}-${i}`}>
          <span className="portfolios-macro-tape__sym">{ix.symbol}</span>
          <span className="portfolios-macro-tape__px font-mono tabular-nums">
            {ix.price !== undefined && Number.isFinite(ix.price) ? formatUsdCompact(ix.price) : "—"}
          </span>
          <span className={`portfolios-macro-tape__chg font-mono tabular-nums ${chgClass}`}>
            {ix.changePercent !== undefined && ix.changePercent > 0 ? "▲ " : ""}
            {ix.changePercent !== undefined && ix.changePercent < 0 ? "▼ " : ""}
            {formatChgPct(ix.changePercent)}
          </span>
        </span>
      );
    });

  return (
    <div className="portfolios-macro-tape" aria-label="US session macro indicators">
      <div className="portfolios-macro-tape__inner">
        <span className="portfolios-macro-tape__badge">HNWI tape</span>
        <div className="portfolios-macro-tape__scroll" role="presentation">
          <div className="portfolios-macro-tape__track">
            <div className="portfolios-macro-tape__strip">{renderStrip("a")}</div>
            <div className="portfolios-macro-tape__strip" aria-hidden>
              {renderStrip("b")}
            </div>
          </div>
        </div>
        <MacroTapeDeskNav deskPortfolioId={deskPortfolioId} visiblePathPrefixes={visiblePathPrefixes} />
      </div>
    </div>
  );
}
