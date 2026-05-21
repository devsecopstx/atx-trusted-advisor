"use client";

import { useCallback, useMemo } from "react";

import {
    CHAIN_COLUMN_LABELS,
    isChainGreekColumnId,
    isFirstVisibleColumnInChainGroup,
    visibleOrderedColumnsFromSaved,
    type XoptionsChainDataColumnId,
    type XoptionsChainSavedLayout
} from "@/lib/xoptions/xoptions-chain-column-layout";
import {
    chainHeatMixPercent,
    chainRowMoneynessClass,
    closestStrikeToSpot,
    filterOptionChainRowsByLiquidity,
    filterStrikesBySpotBand,
    formatImpliedVolatilityDisplay,
    legHasQuotableLastQuote,
    maxVolumeAndOpenInterestForSide,
    sliceStrikesAroundSpot,
    STRIKE_SPOT_BAND_PCT
} from "@/lib/xoptions/xoptions-chain-helpers";
import type { XoptionsChainLeg, XoptionsChainPayload, XoptionsChainRow } from "@/lib/xoptions/xoptions-chain-types";

const DEFAULT_VISIBLE_ROWS = 11;

function legOi(leg: XoptionsChainLeg): number {
  if (!leg) {
    return 0;
  }
  const oi = leg.open_interest;
  return typeof oi === "number" && Number.isFinite(oi) ? oi : 0;
}

function breakevenLong(side: "call" | "put", strike: number, premiumPerShare: number): number {
  if (side === "call") {
    return strike + premiumPerShare;
  }
  return Math.max(0, strike - premiumPerShare);
}

function formatGreek(n: number | undefined, digits: number): string {
  if (n == null || !Number.isFinite(n)) {
    return "—";
  }
  return n.toFixed(digits);
}

function deltaGreekClass(delta: number | undefined): string {
  if (delta == null || !Number.isFinite(delta)) {
    return "xoptions-chain-table__greek-neutral";
  }
  return delta < 0 ? "xoptions-chain-table__greek-delta-neg" : "xoptions-chain-table__greek-delta-pos";
}

function ChainSortHint() {
  return (
    <span className="xoptions-chain-table__sort-hint" aria-hidden="true">
      <span className="xoptions-chain-table__sort-hint-up">↑</span>
      <span className="xoptions-chain-table__sort-hint-down">↓</span>
    </span>
  );
}

export type OptionChainTableProps = {
  chain: XoptionsChainPayload;
  side: "call" | "put";
  selectedStrike: number | null;
  onSelectStrike: (strike: number) => void;
  chainLayoutSaved: XoptionsChainSavedLayout;
  greeksExpanded: boolean;
  showAllStrikes?: boolean;
  maxVisibleRows?: number;
  radioName?: string;
  /** Builder step 4 shows Select column + bid/ask limit hooks; portfolio uses row click only. */
  mode?: "builder" | "portfolio";
  onBidClick?: (strike: number, bid: number) => void;
  onAskClick?: (strike: number, ask: number) => void;
};

export function OptionChainTable({
  chain,
  side,
  selectedStrike,
  onSelectStrike,
  chainLayoutSaved,
  greeksExpanded,
  showAllStrikes = false,
  maxVisibleRows = DEFAULT_VISIBLE_ROWS,
  radioName = "xo-contract-strike-row",
  mode = "builder",
  onBidClick,
  onAskClick
}: OptionChainTableProps) {
  const visibleChainDataCols = useMemo(() => {
    const ordered = visibleOrderedColumnsFromSaved(chainLayoutSaved);
    if (greeksExpanded) {
      return ordered;
    }
    return ordered.filter((id) => !isChainGreekColumnId(id));
  }, [chainLayoutSaved, greeksExpanded]);

  const chainTableColSpan = visibleChainDataCols.length + (mode === "builder" ? 2 : 0);

  const chainChooserThClass = (cid: XoptionsChainDataColumnId) =>
    [
      "xoptions-chain-table__th-pad",
      isChainGreekColumnId(cid) ? "xoptions-chain-table__col-greek" : "",
      cid === "strike" ? "" : "text-right",
      isFirstVisibleColumnInChainGroup(cid, visibleChainDataCols) ? "xoptions-chain-table__col-group-start" : ""
    ]
      .filter(Boolean)
      .join(" ");

  const renderGreekTd = useCallback(
    (
      cid: XoptionsChainDataColumnId,
      kind: "delta" | "gamma" | "theta" | "vega",
      raw: number | undefined,
      digits: number
    ) => {
      const cls =
        kind === "delta"
          ? deltaGreekClass(raw)
          : kind === "theta"
            ? "xoptions-chain-table__greek-theta"
            : "xoptions-chain-table__greek-sky";
      return (
        <td
          key={cid}
          className={`xoptions-chain-table__td-pad xoptions-chain-table__col-greek font-mono tabular-nums tracking-tight align-middle text-right font-semibold ${
            isFirstVisibleColumnInChainGroup(cid, visibleChainDataCols) ? "xoptions-chain-table__col-group-start" : ""
          } ${cls}`}
        >
          {formatGreek(raw, digits)}
        </td>
      );
    },
    [visibleChainDataCols]
  );

  const baseRows = useMemo(
    () => filterOptionChainRowsByLiquidity(chain.optionChain).rows,
    [chain.optionChain]
  );

  const baseRowsInSpotBand = useMemo(() => {
    if (baseRows.length === 0) {
      return [];
    }
    return filterStrikesBySpotBand(baseRows, chain.stockPrice, STRIKE_SPOT_BAND_PCT);
  }, [baseRows, chain.stockPrice]);

  const tableRows = useMemo(() => {
    if (baseRows.length === 0) {
      return [];
    }
    const source = showAllStrikes
      ? baseRows
      : baseRowsInSpotBand.length > 0
        ? baseRowsInSpotBand
        : baseRows;
    return sliceStrikesAroundSpot(source, chain.stockPrice, maxVisibleRows);
  }, [baseRows, baseRowsInSpotBand, chain.stockPrice, maxVisibleRows, showAllStrikes]);

  const tableRowsForDisplay = useMemo(() => {
    if (selectedStrike == null) {
      return tableRows;
    }
    if (tableRows.some((r) => r.strike === selectedStrike)) {
      return tableRows;
    }
    const extra = baseRows.find((r) => r.strike === selectedStrike);
    if (!extra) {
      return tableRows;
    }
    return [...tableRows, extra].sort((a, b) => a.strike - b.strike);
  }, [tableRows, baseRows, selectedStrike]);

  const atmStrike = useMemo(() => {
    if (tableRowsForDisplay.length === 0) {
      return null;
    }
    return closestStrikeToSpot(
      tableRowsForDisplay.map((r) => r.strike),
      chain.stockPrice
    );
  }, [chain.stockPrice, tableRowsForDisplay]);

  const heatMaxes = useMemo(
    () => maxVolumeAndOpenInterestForSide(tableRowsForDisplay, side),
    [tableRowsForDisplay, side]
  );

  const renderRow = (row: XoptionsChainRow) => {
    const leg = side === "call" ? row.call : row.put;
    const spot = chain.stockPrice;
    const moneynessClass = chainRowMoneynessClass(row.strike, spot, side, atmStrike);
    if (!leg || !legHasQuotableLastQuote(leg)) {
      return (
        <tr key={row.strike} className="xoptions-chain-table__row" data-xo-strike={row.strike}>
          <td colSpan={chainTableColSpan} className="xoptions-chain-table__td-pad xoptions-chain-table__empty">
            {row.strike} — no quote
          </td>
        </tr>
      );
    }

    const bid = leg.last_quote.bid;
    const ask = leg.last_quote.ask;
    const mid = (bid + ask) / 2;
    const lastPx = leg.premium != null && Number.isFinite(leg.premium) ? leg.premium : mid;
    const spreadAbs = ask - bid;
    const be = breakevenLong(side, row.strike, mid);
    const selected = selectedStrike === row.strike;
    const ivDisplay = formatImpliedVolatilityDisplay(leg.implied_volatility);
    const vol = typeof leg.volume === "number" && Number.isFinite(leg.volume) ? leg.volume : 0;
    const oiVal = legOi(leg);
    const g = leg.greeks;
    const oiMix = chainHeatMixPercent(oiVal, heatMaxes.maxOi);
    const isAtm = atmStrike != null && Math.abs(row.strike - atmStrike) < 1e-6;
    const oiCellStyle =
      oiMix > 0 ? { background: `color-mix(in srgb, var(--xf-gain-green) ${oiMix}%, transparent)` } : undefined;
    const gb = (cid: XoptionsChainDataColumnId) =>
      isFirstVisibleColumnInChainGroup(cid, visibleChainDataCols) ? "xoptions-chain-table__col-group-start" : "";

    return (
      <tr
        key={row.strike}
        data-xo-strike={row.strike}
        className={`xoptions-chain-table__row xoptions-chain-table__row--interactive ${moneynessClass} ${selected ? "xoptions-contract-row--selected" : ""}`}
        onClick={() => onSelectStrike(row.strike)}
      >
        {mode === "builder" ? (
          <td className="xoptions-chain-table__td-pad align-middle">
            <input
              type="radio"
              name={radioName}
              className="xoptions-contract__radio"
              checked={selected}
              onChange={() => onSelectStrike(row.strike)}
              aria-label={`Strike ${row.strike}`}
            />
          </td>
        ) : null}
        {visibleChainDataCols.map((cid) => {
          if (cid === "strike") {
            return (
              <td
                key={cid}
                className={`xoptions-chain-table__td-pad xoptions-chain-table__strike-cell align-middle ${gb("strike")}`}
              >
                <span className="xoptions-chain-table__strike-val xoptions-chain-table__strike-val--brand font-mono tabular-nums tracking-tight">
                  {row.strike}
                </span>
                {isAtm ? (
                  <span className="xoptions-chain-table__atm-badge xoptions-chain-table__atm-badge--brand">ATM</span>
                ) : null}
              </td>
            );
          }
          if (cid === "bid") {
            return (
              <td
                key={cid}
                className={`xoptions-chain-table__td-pad align-middle text-right xoptions-chain-table__price-col ${gb("bid")}`}
              >
                <div className="flex flex-col items-end gap-0.5">
                  <button
                    type="button"
                    className="xoptions-contract__bid xoptions-contract__bid--emphasis xoptions-chain-table__quote-major xoptions-chain-table__price-figure font-mono tabular-nums tracking-tight text-right"
                    onClick={(e) => {
                      e.stopPropagation();
                      onBidClick?.(row.strike, bid);
                      onSelectStrike(row.strike);
                    }}
                  >
                    ${bid.toFixed(2)}
                  </button>
                  <span className="xoptions-chain-table__spread-hint xoptions-chain-table__spread-hint--dim font-mono tabular-nums tracking-tight">
                    {spreadAbs.toFixed(2)} spread
                  </span>
                </div>
              </td>
            );
          }
          if (cid === "ask") {
            return (
              <td
                key={cid}
                className={`xoptions-chain-table__td-pad xoptions-contract__ask-cell xoptions-chain-table__quote-major xoptions-chain-table__price-col xoptions-chain-table__price-figure font-mono tabular-nums tracking-tight align-middle text-right font-semibold ${gb("ask")}`}
              >
                <button
                  type="button"
                  className="xoptions-contract__ask-cell-btn xoptions-chain-table__quote-major xoptions-chain-table__price-figure font-mono tabular-nums tracking-tight text-right font-semibold"
                  onClick={(e) => {
                    e.stopPropagation();
                    onAskClick?.(row.strike, ask);
                    onSelectStrike(row.strike);
                  }}
                >
                  ${ask.toFixed(2)}
                </button>
              </td>
            );
          }
          if (cid === "mid") {
            return (
              <td
                key={cid}
                className={`xoptions-chain-table__td-pad xoptions-chain-table__mid-cell xoptions-chain-table__quote-major xoptions-chain-table__price-col xoptions-chain-table__price-figure font-mono tabular-nums tracking-tight align-middle text-right font-semibold ${gb("mid")}`}
              >
                ${mid.toFixed(2)}
              </td>
            );
          }
          if (cid === "last") {
            return (
              <td
                key={cid}
                className={`xoptions-chain-table__td-pad xoptions-chain-table__quote-major xoptions-chain-table__price-col xoptions-chain-table__price-figure font-mono tabular-nums tracking-tight align-middle text-right font-semibold ${gb("last")}`}
              >
                ${lastPx.toFixed(2)}
              </td>
            );
          }
          if (cid === "be") {
            return (
              <td
                key={cid}
                className={`xoptions-chain-table__td-pad xoptions-chain-table__price-col xoptions-chain-table__price-figure font-mono tabular-nums tracking-tight align-middle text-right font-semibold ${gb("be")}`}
              >
                ${be.toFixed(2)}
              </td>
            );
          }
          if (cid === "iv") {
            return (
              <td
                key={cid}
                className={`xoptions-chain-table__td-pad xoptions-chain-table__flow-metric font-mono tabular-nums tracking-tight align-middle text-right font-semibold ${gb("iv")}`}
              >
                {ivDisplay}
              </td>
            );
          }
          if (cid === "volume") {
            return (
              <td
                key={cid}
                className={`xoptions-chain-table__td-pad xoptions-chain-table__heat-cell xoptions-chain-table__flow-metric font-mono tabular-nums tracking-tight text-right align-middle font-semibold ${vol > 500 ? "xoptions-chain-table__vol-hot" : ""} ${gb("volume")}`}
              >
                {vol.toLocaleString()}
              </td>
            );
          }
          if (cid === "oi") {
            return (
              <td
                key={cid}
                className={`xoptions-chain-table__td-pad xoptions-chain-table__heat-cell xoptions-chain-table__flow-metric font-mono tabular-nums tracking-tight text-right align-middle font-semibold ${gb("oi")}`}
                style={oiCellStyle}
              >
                {oiVal.toLocaleString()}
              </td>
            );
          }
          if (cid === "delta") {
            return renderGreekTd("delta", "delta", g?.delta, 3);
          }
          if (cid === "gamma") {
            return renderGreekTd("gamma", "gamma", g?.gamma, 4);
          }
          if (cid === "theta") {
            return renderGreekTd("theta", "theta", g?.theta_per_day, 3);
          }
          if (cid === "vega") {
            return renderGreekTd("vega", "vega", g?.vega_per_one_percent_iv, 3);
          }
          return null;
        })}
        {mode === "builder" ? (
          <td className="xoptions-chain-table__select-cell xoptions-chain-table__td-pad text-right align-middle">
            <button
              type="button"
              className="xoptions-chain-table__select-btn"
              onClick={(e) => {
                e.stopPropagation();
                onSelectStrike(row.strike);
              }}
            >
              Select
            </button>
          </td>
        ) : null}
      </tr>
    );
  };

  return (
    <div className="xoptions-chain-table__viewport">
      <table
        className="xoptions-chain-table xoptions-chain-table--compact xoptions-chain-table--contract-chooser xoptions-chain-table--hnwi w-full border-collapse text-left"
        style={{
          minWidth: `${Math.max(44, 10 + visibleChainDataCols.length * 3.35)}rem`
        }}
      >
        <thead>
          <tr className="xoptions-chain-table__head">
            {mode === "builder" ? <th className="xoptions-chain-table__th-pad w-8" scope="col" /> : null}
            {visibleChainDataCols.map((cid) => {
              const meta = CHAIN_COLUMN_LABELS[cid];
              const labelClass =
                cid === "strike"
                  ? "xoptions-chain-table__th-label"
                  : "xoptions-chain-table__th-label xoptions-chain-table__th-label--end";
              return (
                <th key={cid} className={chainChooserThClass(cid)} scope="col" title={meta.title}>
                  <span className={labelClass}>
                    {meta.abbr} <ChainSortHint />
                  </span>
                </th>
              );
            })}
            {mode === "builder" ? (
              <th className="xoptions-chain-table__th-pad w-[4.5rem] text-right" scope="col" aria-label="Row action" />
            ) : null}
          </tr>
        </thead>
        <tbody>{tableRowsForDisplay.map(renderRow)}</tbody>
      </table>
    </div>
  );
}
